import { BLOCKING_STATUSES } from "./constants";
import {
  endOfDayKey,
  minutesOfDay,
  parseDateKey,
  weekdayOfKey,
} from "./datetime";
import { prisma } from "./prisma";
import { getShop } from "./shop";

export type AgendaAppointment = {
  id: string;
  start: string;
  end: string;
  status: string;
  priceCents: number;
  notes: string | null;
  reminderSentAt: string | null;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientHairType: string | null;
  clientPreferredStyle: string | null;
  serviceName: string;
  serviceDuration: number;
  barberId: string;
  barberName: string;
  barberColor: string;
};

export type AgendaBarber = {
  id: string;
  name: string;
  color: string;
  appointments: AgendaAppointment[];
};

export type Agenda = {
  dayKey: string;
  weekday: number;
  openMinute: number;
  closeMinute: number;
  closed: boolean;
  barbers: AgendaBarber[];
  totals: {
    appointments: number;
    confirmed: number;
    pending: number;
    completed: number;
    cancelled: number;
    estimatedCents: number;
    completedCents: number;
    bookedMinutes: number;
    totalMinutes: number;
    occupancy: number;
  };
};

export async function getAgenda(
  dayKey: string,
  options?: { barberId?: string },
): Promise<Agenda> {
  const shop = await getShop();
  const weekday = weekdayOfKey(dayKey, shop.timezone);
  const hours = await prisma.businessHour.findUnique({ where: { weekday } });
  const openMinute = hours?.active ? hours.openMinute : 0;
  const closeMinute = hours?.active ? hours.closeMinute : 0;

  const barbers = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: ["ADMIN", "BARBER"] },
      ...(options?.barberId ? { id: options.barberId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });

  const dayStart = parseDateKey(dayKey, shop.timezone);
  const dayEnd = endOfDayKey(dayKey, shop.timezone);

  const appointments = await prisma.appointment.findMany({
    where: {
      barberId: { in: barbers.map((b) => b.id) },
      start: { lt: dayEnd },
      end: { gt: dayStart },
    },
    orderBy: { start: "asc" },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          hairType: true,
          preferredStyle: true,
        },
      },
      service: { select: { name: true, durationMin: true } },
      barber: { select: { id: true, name: true, color: true } },
    },
  });

  const grouped = new Map<string, AgendaAppointment[]>();
  for (const barber of barbers) grouped.set(barber.id, []);

  let confirmed = 0;
  let pending = 0;
  let completed = 0;
  let cancelled = 0;
  let estimatedCents = 0;
  let completedCents = 0;
  let bookedMinutes = 0;

  for (const appointment of appointments) {
    const mapped: AgendaAppointment = {
      id: appointment.id,
      start: appointment.start.toISOString(),
      end: appointment.end.toISOString(),
      status: appointment.status,
      priceCents: appointment.priceCents,
      notes: appointment.notes,
      reminderSentAt: appointment.reminderSentAt?.toISOString() ?? null,
      clientId: appointment.client.id,
      clientName: appointment.client.name,
      clientPhone: appointment.client.phone,
      clientHairType: appointment.client.hairType,
      clientPreferredStyle: appointment.client.preferredStyle,
      serviceName: appointment.service.name,
      serviceDuration: appointment.service.durationMin,
      barberId: appointment.barber.id,
      barberName: appointment.barber.name,
      barberColor: appointment.barber.color,
    };
    grouped.get(appointment.barberId)?.push(mapped);

    if (appointment.status === "CONFIRMED") confirmed += 1;
    if (appointment.status === "PENDING") pending += 1;
    if (appointment.status === "COMPLETED") completed += 1;
    if (appointment.status === "CANCELLED") cancelled += 1;

    if (BLOCKING_STATUSES.includes(appointment.status)) {
      estimatedCents += appointment.priceCents;
      const startMinute = minutesOfDay(appointment.start, shop.timezone);
      const endMinute = minutesOfDay(appointment.end, shop.timezone);
      bookedMinutes += Math.max(
        0,
        Math.min(endMinute, closeMinute) - Math.max(startMinute, openMinute),
      );
      if (appointment.status === "COMPLETED") {
        completedCents += appointment.priceCents;
      }
    }
  }

  const totalMinutes = hours?.active
    ? (closeMinute - openMinute) * barbers.length
    : 0;

  return {
    dayKey,
    weekday,
    openMinute,
    closeMinute,
    closed: !hours?.active,
    barbers: barbers.map((barber) => ({
      id: barber.id,
      name: barber.name,
      color: barber.color,
      appointments: grouped.get(barber.id) ?? [],
    })),
    totals: {
      appointments: appointments.length,
      confirmed,
      pending,
      completed,
      cancelled,
      estimatedCents,
      completedCents,
      bookedMinutes,
      totalMinutes,
      occupancy: totalMinutes > 0 ? (bookedMinutes / totalMinutes) * 100 : 0,
    },
  };
}
