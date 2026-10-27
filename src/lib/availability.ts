import { BLOCKING_STATUSES } from "./constants";
import {
  dateKey,
  instantAtKeyMinute,
  minutesOfDay,
  parseDateKey,
  weekdayOfKey,
  endOfDayKey,
} from "./datetime";
import { prisma } from "./prisma";
import { getShop } from "./shop";

export type AvailabilitySlot = {
  start: string;
  end: string;
  barberId: string;
  barberName: string;
  barberColor: string;
};

type BusyRange = { start: Date; end: Date };

function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
  buffer = 0,
) {
  return (
    aStart.getTime() < bEnd.getTime() + buffer * 60_000 &&
    aEnd.getTime() > bStart.getTime() - buffer * 60_000
  );
}

export async function getAvailability({
  dayKey,
  serviceId,
  barberId,
}: {
  dayKey: string;
  serviceId: string;
  barberId?: string;
}): Promise<AvailabilitySlot[]> {
  const shop = await getShop();

  const service = await prisma.service.findFirst({
    where: { id: serviceId, active: true },
  });
  if (!service) return [];

  const weekday = weekdayOfKey(dayKey, shop.timezone);
  const hours = await prisma.businessHour.findUnique({ where: { weekday } });
  if (!hours?.active) return [];

  const dayStart = parseDateKey(dayKey, shop.timezone);
  const dayEnd = endOfDayKey(dayKey, shop.timezone);
  const now = new Date();
  const minStart = new Date(now.getTime() + shop.leadTimeMin * 60_000);

  const barbers = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: ["ADMIN", "BARBER"] },
      ...(barberId ? { id: barberId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  if (barbers.length === 0) return [];

  const [appointments, timeOff] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        barberId: { in: barbers.map((b) => b.id) },
        status: { in: BLOCKING_STATUSES },
        start: { lt: dayEnd },
        end: { gt: dayStart },
      },
      select: { barberId: true, start: true, end: true },
    }),
    prisma.timeOff.findMany({
      where: {
        start: { lt: dayEnd },
        end: { gt: dayStart },
      },
      select: { userId: true, start: true, end: true },
    }),
  ]);

  const byBarber = new Map<string, BusyRange[]>();
  for (const barber of barbers) byBarber.set(barber.id, []);

  for (const appointment of appointments) {
    byBarber.get(appointment.barberId)?.push({
      start: appointment.start,
      end: appointment.end,
    });
  }

  for (const off of timeOff) {
    if (off.userId) {
      byBarber.get(off.userId)?.push({ start: off.start, end: off.end });
    } else {
      for (const barber of barbers) {
        byBarber.get(barber.id)?.push({ start: off.start, end: off.end });
      }
    }
  }

  const slotsByStart = new Map<
    number,
    { slot: AvailabilitySlot; load: number; barberName: string }
  >();

  for (const barber of barbers) {
    const busy = byBarber.get(barber.id) ?? [];
    const load = busy.reduce(
      (total, range) =>
        total + Math.max(0, range.end.getTime() - range.start.getTime()),
      0,
    );

    for (
      let minute = hours.openMinute;
      minute + service.durationMin <= hours.closeMinute;
      minute += shop.slotStepMin
    ) {
      const start = instantAtKeyMinute(dayKey, minute, shop.timezone);
      const end = new Date(start.getTime() + service.durationMin * 60_000);

      if (start < minStart) continue;
      if (start >= dayEnd) break;

      const conflict = busy.some((range) =>
        overlaps(start, end, range.start, range.end, shop.bufferMin),
      );
      if (conflict) continue;

      const startKey = start.getTime();
      const existing = slotsByStart.get(startKey);
      if (!existing || load < existing.load) {
        slotsByStart.set(startKey, {
          slot: {
            start: start.toISOString(),
            end: end.toISOString(),
            barberId: barber.id,
            barberName: barber.name,
            barberColor: barber.color,
          },
          load,
          barberName: barber.name,
        });
      }
    }
  }

  return Array.from(slotsByStart.entries())
    .sort(([a], [b]) => a - b)
    .map(([, value]) => value.slot);
}

export function slotDayKey(slot: { start: string }, timezone: string) {
  return dateKey(new Date(slot.start), timezone);
}

export function minutesOfSlot(start: Date, timezone: string) {
  return minutesOfDay(start, timezone);
}
