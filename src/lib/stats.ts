import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { BLOCKING_STATUSES } from "./constants";
import { addDaysToKey, dateKey, parseDateKey, todayKey } from "./datetime";
import { getAgenda } from "./agenda";
import { fetchAppointmentsSince, fetchShop } from "./data";

export type Overview = {
  days: number;
  totalAppointments: number;
  completed: number;
  revenueCents: number;
  avgTicketCents: number;
  uniqueClients: number;
  returningClients: number;
  newClients: number;
  retentionRate: number;
  cancellations: number;
  noShows: number;
  statusCounts: Record<string, number>;
  daily: {
    key: string;
    label: string;
    count: number;
    revenueCents: number;
  }[];
  topServices: { name: string; count: number; revenueCents: number }[];
  topBarbers: {
    id: string;
    name: string;
    color: string;
    count: number;
    revenueCents: number;
  }[];
  hours: { hour: number; count: number }[];
};

export async function getOverview({
  days = 30,
  barberId,
}: {
  days?: number;
  barberId?: string;
} = {}): Promise<Overview> {
  const shop = await fetchShop();
  const tz = shop.timezone;
  const safeDays = Math.min(Math.max(days, 1), 365);
  const today = todayKey(tz);
  const startKey = addDaysToKey(today, -(safeDays - 1), tz);
  const start = parseDateKey(startKey, tz);
  const now = new Date();

  const appointments = await fetchAppointmentsSince(
    start.toISOString(),
    now.toISOString(),
    barberId,
  );

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const revenueCents = completed.reduce((total, a) => total + a.priceCents, 0);

  const clientVisits = new Map<string, number>();
  const clientCreated = new Map<string, Date>();
  for (const appointment of completed) {
    clientVisits.set(
      appointment.clientId,
      (clientVisits.get(appointment.clientId) ?? 0) + 1,
    );
    if (appointment.client?.createdAt) {
      clientCreated.set(appointment.clientId, new Date(appointment.client.createdAt));
    }
  }

  let returningClients = 0;
  let newClients = 0;
  for (const [clientId, visits] of clientVisits) {
    if (visits >= 2) returningClients += 1;
    const createdAt = clientCreated.get(clientId);
    if (createdAt && createdAt >= start) newClients += 1;
  }

  const statusCounts: Record<string, number> = {};
  for (const appointment of appointments) {
    statusCounts[appointment.status] =
      (statusCounts[appointment.status] ?? 0) + 1;
  }

  const dailyMap = new Map<string, { count: number; revenueCents: number }>();
  for (let index = 0; index < Math.min(safeDays, 30); index++) {
    const key = addDaysToKey(startKey, index, tz);
    dailyMap.set(key, { count: 0, revenueCents: 0 });
  }
  if (safeDays > 30) {
    dailyMap.clear();
    for (let index = 0; index < 30; index++) {
      const key = addDaysToKey(today, -(29 - index), tz);
      dailyMap.set(key, { count: 0, revenueCents: 0 });
    }
  }

  const serviceMap = new Map<
    string,
    { name: string; count: number; revenueCents: number }
  >();
  const barberMap = new Map<
    string,
    { id: string; name: string; color: string; count: number; revenueCents: number }
  >();
  const hours = Array.from({ length: 14 }, (_, index) => ({
    hour: index + 8,
    count: 0,
  }));

  for (const appointment of completed) {
    const key = dateKey(new Date(appointment.start), tz);
    const day = dailyMap.get(key);
    if (day) {
      day.count += 1;
      day.revenueCents += appointment.priceCents;
    }

    const serviceName = appointment.service?.name ?? "Sin servicio";
    const service = serviceMap.get(serviceName) ?? {
      name: serviceName,
      count: 0,
      revenueCents: 0,
    };
    service.count += 1;
    service.revenueCents += appointment.priceCents;
    serviceMap.set(serviceName, service);

    const barberInfo = appointment.barber;
    if (barberInfo) {
      const barber = barberMap.get(barberInfo.id) ?? {
        id: barberInfo.id,
        name: barberInfo.name,
        color: barberInfo.color,
        count: 0,
        revenueCents: 0,
      };
      barber.count += 1;
      barber.revenueCents += appointment.priceCents;
      barberMap.set(barberInfo.id, barber);
    }

    const hour = Number(formatInTimeZone(new Date(appointment.start), tz, "H"));
    const bucket = hours.find((h) => h.hour === hour);
    if (bucket) bucket.count += 1;
  }

  return {
    days: safeDays,
    totalAppointments: appointments.length,
    completed: completed.length,
    revenueCents,
    avgTicketCents: completed.length
      ? Math.round(revenueCents / completed.length)
      : 0,
    uniqueClients: clientVisits.size,
    returningClients,
    newClients,
    retentionRate:
      clientVisits.size > 0 ? (returningClients / clientVisits.size) * 100 : 0,
    cancellations: appointments.filter((a) => a.status === "CANCELLED").length,
    noShows: appointments.filter((a) => a.status === "NO_SHOW").length,
    statusCounts,
    daily: Array.from(dailyMap.entries()).map(([key, value]) => ({
      key,
      label: formatInTimeZone(parseDateKey(key, tz), tz, "d MMM", {
        locale: es,
      }),
      ...value,
    })),
    topServices: Array.from(serviceMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topBarbers: Array.from(barberMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    hours,
  };
}

export async function getTodaySummary(barberId?: string) {
  const tz = (await fetchShop()).timezone;
  const agenda = await getAgenda(todayKey(tz), { barberId });
  const now = new Date().toISOString();

  const all = agenda.barbers.flatMap((barber) => barber.appointments);
  const upcoming = all
    .filter(
      (appointment) =>
        appointment.start > now &&
        (appointment.status === "CONFIRMED" ||
          appointment.status === "PENDING"),
    )
    .sort((a, b) => a.start.localeCompare(b.start));

  return {
    agenda,
    upcoming,
    nextAppointment: upcoming[0] ?? null,
    revenueTodayCents: agenda.totals.completedCents,
    expectedTodayCents: agenda.totals.estimatedCents,
    occupancy: agenda.totals.occupancy,
  };
}

export function occupancyLabel(value: number) {
  return `${Math.round(value)}%`;
}

export function isBlockingStatus(status: string) {
  return BLOCKING_STATUSES.includes(status);
}
