import type { Prisma } from "@prisma/client";
import { BLOCKING_STATUSES } from "./constants";
import {
  dateKey,
  formatDateTime,
  minutesOfDay,
  weekdayOfKey,
} from "./datetime";
import { prisma } from "./prisma";
import { getShop } from "./shop";

export type PublicBookingInput = {
  serviceId: string;
  barberId: string;
  start: string;
  name: string;
  phone: string;
  email?: string;
  hairType?: string;
  preferredStyle?: string;
  notes?: string;
};

export type StaffBookingInput = {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  barberId: string;
  serviceId: string;
  start: string;
  status?: string;
  notes?: string;
  source?: string;
};

export type BookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string };

export function normalizePhone(input: string) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

async function findConflict(
  db: Prisma.TransactionClient | typeof prisma,
  {
    barberId,
    start,
    end,
    bufferMin,
    excludeId,
  }: {
    barberId: string;
    start: Date;
    end: Date;
    bufferMin: number;
    excludeId?: string;
  },
) {
  const appointment = await db.appointment.findFirst({
    where: {
      barberId,
      status: { in: BLOCKING_STATUSES },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      start: { lt: new Date(end.getTime() + bufferMin * 60_000) },
      end: { gt: new Date(start.getTime() - bufferMin * 60_000) },
    },
    select: { id: true },
  });
  if (appointment) return "Ese horario ya está ocupado. Elegí otro turno.";

  const off = await db.timeOff.findFirst({
    where: {
      OR: [{ userId: null }, { userId: barberId }],
      start: { lt: end },
      end: { gt: start },
    },
    select: { id: true },
  });
  if (off) return "El barbero no está disponible en ese horario.";

  return null;
}

function validateWithinHours(
  shop: Awaited<ReturnType<typeof getShop>>,
  hours: { openMinute: number; closeMinute: number } | null,
  start: Date,
  durationMin: number,
) {
  if (!hours) return "La barbería está cerrada ese día.";
  const startMinute = minutesOfDay(start, shop.timezone);
  if (
    startMinute < hours.openMinute ||
    startMinute + durationMin > hours.closeMinute
  ) {
    return "Ese horario está fuera del horario de atención.";
  }
  return null;
}

export async function createPublicBooking(
  input: PublicBookingInput,
): Promise<BookingResult> {
  const shop = await getShop();
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, active: true },
  });
  if (!service) return { ok: false, error: "El servicio no está disponible." };

  const barber = await prisma.user.findFirst({
    where: {
      id: input.barberId,
      active: true,
      role: { in: ["ADMIN", "BARBER"] },
    },
  });
  if (!barber) return { ok: false, error: "El barbero no está disponible." };

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "El horario elegido no es válido." };
  }

  const now = new Date();
  const leadLimit = new Date(now.getTime() + shop.leadTimeMin * 60_000);
  if (start < leadLimit) {
    return {
      ok: false,
      error: "Ese horario ya no está disponible. Elegí otro turno.",
    };
  }

  const windowLimit = new Date(
    now.getTime() + shop.bookingWindowDays * 24 * 60 * 60_000,
  );
  if (start > windowLimit) {
    return {
      ok: false,
      error: "Todavía no se pueden reservar turnos para esa fecha.",
    };
  }

  const dayKey = dateKey(start, shop.timezone);
  const weekday = weekdayOfKey(dayKey, shop.timezone);
  const hours = await prisma.businessHour.findUnique({ where: { weekday } });
  const hoursError = validateWithinHours(
    shop,
    hours?.active ? hours : null,
    start,
    service.durationMin,
  );
  if (hoursError) return { ok: false, error: hoursError };

  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const phone = normalizePhone(input.phone);
  if (phone.length < 6) {
    return { ok: false, error: "Ingresá un teléfono válido." };
  }

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const conflict = await findConflict(tx, {
        barberId: barber.id,
        start,
        end,
        bufferMin: shop.bufferMin,
      });
      if (conflict) throw new Error(conflict);

      const existing = await tx.client.findUnique({ where: { phone } });
      const client = existing
        ? await tx.client.update({
            where: { id: existing.id },
            data: {
              name: input.name.trim() || existing.name,
              email: input.email?.trim() || existing.email,
              hairType: input.hairType?.trim() || existing.hairType,
              preferredStyle:
                input.preferredStyle?.trim() || existing.preferredStyle,
            },
          })
        : await tx.client.create({
            data: {
              name: input.name.trim(),
              phone,
              email: input.email?.trim() || null,
              hairType: input.hairType?.trim() || null,
              preferredStyle: input.preferredStyle?.trim() || null,
            },
          });

      const created = await tx.appointment.create({
        data: {
          clientId: client.id,
          barberId: barber.id,
          serviceId: service.id,
          start,
          end,
          status: "CONFIRMED",
          priceCents: service.priceCents,
          notes: input.notes?.trim() || null,
          source: "PUBLIC",
        },
      });

      await tx.notification.create({
        data: {
          userId: barber.id,
          title: "Nuevo turno reservado",
          body: `${client.name} reservó ${service.name} para el ${formatDateTime(start, shop.timezone)}.`,
          href: `/panel/agenda?date=${dayKey}`,
        },
      });

      return created;
    });

    return { ok: true, appointmentId: appointment.id };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "No se pudo crear la reserva." };
  }
}

export async function createStaffAppointment(
  input: StaffBookingInput,
): Promise<BookingResult> {
  const shop = await getShop();
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, active: true },
  });
  if (!service) return { ok: false, error: "El servicio no está disponible." };

  const barber = await prisma.user.findFirst({
    where: { id: input.barberId, active: true },
  });
  if (!barber) return { ok: false, error: "El barbero no está disponible." };

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "La fecha y hora no son válidas." };
  }

  const dayKey = dateKey(start, shop.timezone);
  const weekday = weekdayOfKey(dayKey, shop.timezone);
  const hours = await prisma.businessHour.findUnique({ where: { weekday } });
  const hoursError = validateWithinHours(
    shop,
    hours?.active ? hours : null,
    start,
    service.durationMin,
  );
  if (hoursError) return { ok: false, error: hoursError };

  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const status = input.status === "PENDING" ? "PENDING" : "CONFIRMED";

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const conflict = await findConflict(tx, {
        barberId: barber.id,
        start,
        end,
        bufferMin: shop.bufferMin,
      });
      if (conflict) throw new Error(conflict);

      let clientId = input.clientId;

      if (!clientId) {
        const phone = normalizePhone(input.clientPhone ?? "");
        if (!input.clientName?.trim() || phone.length < 6) {
          throw new Error("Indicá el nombre y teléfono del cliente.");
        }

        const existing = await tx.client.findUnique({ where: { phone } });
        if (existing) {
          clientId = existing.id;
        } else {
          const created = await tx.client.create({
            data: {
              name: input.clientName.trim(),
              phone,
              email: input.clientEmail?.trim() || null,
            },
          });
          clientId = created.id;
        }
      }

      const created = await tx.appointment.create({
        data: {
          clientId,
          barberId: barber.id,
          serviceId: service.id,
          start,
          end,
          status,
          priceCents: service.priceCents,
          notes: input.notes?.trim() || null,
          source: input.source ?? "STAFF",
        },
      });

      return created;
    });

    return { ok: true, appointmentId: appointment.id };
  } catch (error) {
    if (error instanceof Error) return { ok: false, error: error.message };
    return { ok: false, error: "No se pudo crear el turno." };
  }
}
