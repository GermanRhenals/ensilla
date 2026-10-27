"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  Lightbulb,
  Plus,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/lib/auth-context";
import { fetchShop } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatMoney, initials } from "@/lib/format";
import { suggestIdeas } from "@/lib/ideas";
import { getOverview, getTodaySummary } from "@/lib/stats";
import { useAsync } from "@/lib/use-async";

export default function DashboardPage() {
  const { profile: user } = useAuth();
  const { data } = useAsync(async () => {
    if (!user) return null;
    const shop = await fetchShop();
    const scopedBarberId = user.role === "ADMIN" ? undefined : user.id;
    const [today, overview] = await Promise.all([
      getTodaySummary(scopedBarberId),
      getOverview({ days: 30, barberId: scopedBarberId }),
    ]);
    return { shop, today, overview };
  }, `dashboard-${user?.id ?? ""}`);

  if (!user || !data) return null;
  const { shop, today, overview } = data;

  const hour = Number(formatInTimeZone(new Date(), shop.timezone, "H"));
  const greeting =
    hour < 12 ? "Buen día" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const todayAppointments = today.agenda.barbers.flatMap(
    (barber) => barber.appointments,
  );
  const activeToday = todayAppointments.filter(
    (appointment) =>
      appointment.status === "CONFIRMED" || appointment.status === "PENDING",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            {formatDate(new Date(), "EEEE d 'de' MMMM", shop.timezone)}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting}, {user.name.split(" ")[0]}.
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            {todayAppointments.length > 0
              ? `Hoy hay ${todayAppointments.length} turnos en la agenda.`
              : "Todavía no hay turnos para hoy."}{" "}
            {today.nextAppointment
              ? `El próximo es a las ${formatTime(new Date(today.nextAppointment.start), shop.timezone)}.`
              : "Aprovechá para cargar la agenda."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/panel/agenda" className="btn-secondary">
            <CalendarDays className="size-4" />
            Ver agenda
          </Link>
          <Link href="/panel/citas/nueva" className="btn-primary">
            <Plus className="size-4" />
            Nueva cita
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Turnos hoy"
          value={todayAppointments.length}
          hint={`${activeToday.length} por venir`}
          icon={<CalendarClock className="size-4" />}
        />
        <StatCard
          label="Ingresos de hoy"
          value={formatMoney(today.revenueTodayCents, shop.currency, shop.locale)}
          hint={`${formatMoney(today.expectedTodayCents, shop.currency, shop.locale)} estimado`}
          icon={<Banknote className="size-4" />}
          tone="copper"
        />
        <StatCard
          label="Ocupación"
          value={`${Math.round(today.occupancy)}%`}
          hint={`${today.agenda.totals.bookedMinutes} min reservados`}
          icon={<Gauge className="size-4" />}
          tone="sage"
        />
        <StatCard
          label="Próximo turno"
          value={
            today.nextAppointment
              ? formatTime(new Date(today.nextAppointment.start), shop.timezone)
              : "—"
          }
          hint={
            today.nextAppointment
              ? `${today.nextAppointment.clientName.split(" ")[0]} · ${today.nextAppointment.serviceName}`
              : "Sin turnos próximos"
          }
          icon={<Clock3 className="size-4" />}
          tone="ink"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold">Agenda de hoy</h2>
              <p className="text-xs text-stone-500">
                {shop.name} · {today.agenda.barbers.length} barberos activos
              </p>
            </div>
            <Link
              href="/panel/agenda"
              className="inline-flex items-center gap-1 text-xs font-semibold text-copper"
            >
              Ver completa
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-line">
            {today.agenda.barbers.map((barber) => (
              <div key={barber.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: `${barber.color}1f`,
                        color: barber.color,
                      }}
                    >
                      {initials(barber.name)}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{barber.name}</p>
                      <p className="text-[11px] text-stone-400">
                        {barber.appointments.length} turnos
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/panel/agenda?date=${today.agenda.dayKey}&barber=${barber.id}`}
                    className="text-[11px] font-semibold text-stone-400 transition hover:text-copper"
                  >
                    Abrir día
                  </Link>
                </div>

                <div className="mt-3 space-y-1.5">
                  {barber.appointments.length === 0 && (
                    <p className="rounded-lg bg-sand/50 px-3 py-2 text-xs text-stone-400">
                      Sin turnos asignados.
                    </p>
                  )}
                  {barber.appointments.slice(0, 4).map((appointment) => (
                    <Link
                      key={appointment.id}
                      href={`/panel/citas/detalle?id=${appointment.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-sand/60"
                    >
                      <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-stone-500">
                        {formatTime(new Date(appointment.start), shop.timezone)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {appointment.clientName}
                      </span>
                      <span className="hidden truncate text-xs text-stone-400 sm:block">
                        {appointment.serviceName}
                      </span>
                      <StatusBadge status={appointment.status} />
                    </Link>
                  ))}
                  {barber.appointments.length > 4 && (
                    <p className="pl-13 text-[11px] text-stone-400">
                      +{barber.appointments.length - 4} turnos más
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Para anticiparte</h2>
                <p className="text-xs text-stone-500">
                  Ideas para los próximos clientes
                </p>
              </div>
              <Sparkles className="size-4 text-copper" />
            </div>

            <div className="mt-4 space-y-3">
              {today.upcoming.slice(0, 3).map((appointment) => {
                const idea = suggestIdeas(
                  {
                    hairType: appointment.clientHairType,
                    preferredStyle: appointment.clientPreferredStyle,
                  },
                  { visits: 3 },
                )[0];
                return (
                  <Link
                    key={appointment.id}
                    href={`/panel/clientes/detalle?id=${appointment.clientId}`}
                    className="block rounded-xl border border-line bg-cream/40 p-3.5 transition hover:border-copper/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {appointment.clientName}
                      </p>
                      <span className="text-[11px] text-stone-400">
                        {formatTime(
                          new Date(appointment.start),
                          shop.timezone,
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      {appointment.clientHairType ??
                        "Sin preferencias registradas"}
                      {appointment.clientPreferredStyle
                        ? ` · ${appointment.clientPreferredStyle}`
                        : ""}
                    </p>
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-copper-dark">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                      {idea.title}
                    </p>
                  </Link>
                );
              })}
              {today.upcoming.length === 0 && (
                <p className="rounded-xl bg-sand/50 px-3.5 py-3 text-xs text-stone-500">
                  No quedan turnos por venir hoy. Revisá la agenda de mañana.
                </p>
              )}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Últimos 30 días</h2>
                <p className="text-xs text-stone-500">
                  Cómo viene la barbería
                </p>
              </div>
              <Link
                href="/panel/estadisticas"
                className="text-[11px] font-semibold text-copper"
              >
                Ver todo
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-sand/60 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  <Banknote className="size-3" />
                  Ingresos
                </p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {formatMoney(overview.revenueCents, shop.currency, shop.locale)}
                </p>
              </div>
              <div className="rounded-xl bg-sand/60 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  <CheckCircle2 className="size-3" />
                  Cortes
                </p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {overview.completed}
                </p>
              </div>
              <div className="rounded-xl bg-sand/60 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  <TrendingUp className="size-3" />
                  Ticket
                </p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {formatMoney(overview.avgTicketCents, shop.currency, shop.locale)}
                </p>
              </div>
              <div className="rounded-xl bg-sand/60 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  {user.role === "ADMIN" ? (
                    <UserPlus className="size-3" />
                  ) : (
                    <Users className="size-3" />
                  )}
                  {user.role === "ADMIN" ? "Nuevos" : "Atendidos"}
                </p>
                <p className="mt-1 font-display text-xl font-semibold">
                  {user.role === "ADMIN"
                    ? overview.newClients
                    : overview.uniqueClients}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
