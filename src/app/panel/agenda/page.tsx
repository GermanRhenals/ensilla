"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Banknote,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  Plus,
  Users,
} from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { getAgenda } from "@/lib/agenda";
import { useAuth } from "@/lib/auth-context";
import { fetchBarbers, fetchShop } from "@/lib/data";
import {
  addDaysToKey,
  formatLongDate,
  formatTime,
  minutesOfDay,
  minutesToTime,
  parseDateKey,
  todayKey,
} from "@/lib/datetime";
import { formatMoney, initials } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const blockStyles: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50/80",
  CONFIRMED: "border-line bg-white",
  COMPLETED: "border-stone-200 bg-stone-50",
  CANCELLED: "border-rose-200 bg-rose-50/70 opacity-70",
  NO_SHOW: "border-orange-200 bg-orange-50/70 opacity-80",
};

export default function AgendaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <AgendaContent />
    </Suspense>
  );
}

function AgendaContent() {
  const params = useSearchParams();
  const { profile: user } = useAuth();
  const dateParam = params.get("date");
  const barberParam = params.get("barber");
  const { data } = useAsync(async () => {
    if (!user) return null;
    const [shop, activeBarbers] = await Promise.all([
      fetchShop(),
      fetchBarbers(),
    ]);
    const tz = shop.timezone;
    const requestedDate =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : todayKey(tz);
    const requestedBarber =
      user.role === "ADMIN" && barberParam ? barberParam : undefined;
    const agenda = await getAgenda(requestedDate, {
      barberId: user.role === "ADMIN" ? requestedBarber : user.id,
    });
    return {
      shop,
      agenda,
      activeBarbers: activeBarbers.filter((barber) => barber.active),
      requestedDate,
      requestedBarber,
      isToday: requestedDate === todayKey(tz),
      prevKey: addDaysToKey(requestedDate, -1, tz),
      nextKey: addDaysToKey(requestedDate, 1, tz),
    };
  }, `agenda-${user?.id ?? ""}-${dateParam ?? ""}-${barberParam ?? ""}`);

  if (!user || !data) return null;
  const {
    shop,
    agenda,
    activeBarbers,
    requestedDate,
    requestedBarber,
    isToday,
    prevKey,
    nextKey,
  } = data;
  const tz = shop.timezone;
  const now = new Date();
  const nowMinutes = minutesOfDay(now, tz);

  const hasAppointments = agenda.barbers.some(
    (barber) => barber.appointments.length > 0,
  );
  const closed = agenda.closed && !hasAppointments;

  const openMinute = agenda.closed
    ? hasAppointments
      ? 600
      : agenda.openMinute
    : agenda.openMinute;
  const closeMinute = agenda.closed
    ? hasAppointments
      ? 1200
      : agenda.closeMinute
    : agenda.closeMinute;
  const scale = 1.1;
  const height = Math.max(0, (closeMinute - openMinute) * scale);

  const hourMarks: number[] = [];
  for (
    let minute = Math.ceil(openMinute / 60) * 60;
    minute <= closeMinute;
    minute += 60
  ) {
    hourMarks.push(minute);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            Agenda
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold capitalize tracking-tight">
            {formatLongDate(parseDateKey(requestedDate, tz), tz)}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {closed
              ? "Barbería cerrada."
              : `${agenda.totals.appointments} turnos · ${agenda.totals.confirmed} confirmados · ${agenda.totals.pending} pendientes`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-white p-1">
            <Link
              href={`/panel/agenda?date=${prevKey}${requestedBarber ? `&barber=${requestedBarber}` : ""}`}
              className="flex size-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-sand hover:text-ink"
              aria-label="Día anterior"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <Link
              href={`/panel/agenda${requestedBarber ? `?barber=${requestedBarber}` : ""}`}
              className={`px-3 text-xs font-semibold ${isToday ? "text-copper" : "text-stone-600"}`}
            >
              Hoy
            </Link>
            <Link
              href={`/panel/agenda?date=${nextKey}${requestedBarber ? `&barber=${requestedBarber}` : ""}`}
              className="flex size-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-sand hover:text-ink"
              aria-label="Día siguiente"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <Link
            href={`/panel/citas/nueva?date=${requestedDate}`}
            className="btn-primary"
          >
            <Plus className="size-4" />
            Nueva cita
          </Link>
        </div>
      </div>

      <Flash
        ok={params.get("ok") ?? undefined}
        error={params.get("error") ?? undefined}
      />

      {user.role === "ADMIN" && activeBarbers.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`/panel/agenda?date=${requestedDate}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              !requestedBarber
                ? "border-ink bg-ink text-cream"
                : "border-line bg-white text-stone-500 hover:text-ink"
            }`}
          >
            Todo el equipo
          </Link>
          {activeBarbers.map((barber) => (
            <Link
              key={barber.id}
              href={`/panel/agenda?date=${requestedDate}&barber=${barber.id}`}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                requestedBarber === barber.id
                  ? "border-ink bg-ink text-cream"
                  : "border-line bg-white text-stone-500 hover:text-ink"
              }`}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: barber.color }}
              />
              {barber.name.split(" ")[0]}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Turnos",
            value: agenda.totals.appointments,
            icon: CalendarClock,
            hint: `${agenda.totals.completed} completados`,
          },
          {
            label: "Confirmados",
            value: agenda.totals.confirmed,
            icon: Users,
            hint: `${agenda.totals.pending} pendientes`,
          },
          {
            label: "Estimado",
            value: formatMoney(agenda.totals.estimatedCents, shop.currency),
            icon: Banknote,
            hint: `${formatMoney(agenda.totals.completedCents, shop.currency)} cobrados`,
          },
          {
            label: "Ocupación",
            value: `${Math.round(agenda.totals.occupancy)}%`,
            icon: Gauge,
            hint: `${agenda.totals.bookedMinutes} de ${agenda.totals.totalMinutes} min`,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-sand text-stone-500">
              <item.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                {item.label}
              </p>
              <p className="font-display text-lg font-semibold leading-tight">
                {item.value}
              </p>
              <p className="truncate text-[10px] text-stone-400">{item.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {closed ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-sand text-stone-500">
            <CalendarDays className="size-5" />
          </span>
          <p className="mt-3 font-display text-xl font-semibold">
            La barbería está cerrada este día.
          </p>
          <p className="mt-1 max-w-sm text-sm text-stone-500">
            Podés cargar un turno manual o revisar el próximo día de atención.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href={`/panel/agenda?date=${nextKey}`}
              className="btn-secondary"
            >
              Ver día siguiente
            </Link>
            <Link
              href={`/panel/citas/nueva?date=${requestedDate}`}
              className="btn-primary"
            >
              <Plus className="size-4" />
              Cargar turno
            </Link>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex border-b border-line bg-sand/40">
            <div className="w-14 shrink-0" />
            {agenda.barbers.map((barber) => (
              <div
                key={barber.id}
                className="min-w-[200px] flex-1 border-l border-line px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-7 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${barber.color}1f`,
                      color: barber.color,
                    }}
                  >
                    {initials(barber.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {barber.name}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {barber.appointments.length} turnos
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex overflow-x-auto scroll-thin">
            <div
              className="relative w-14 shrink-0 bg-sand/20"
              style={{ height }}
            >
              {hourMarks.map((minute) => (
                <div
                  key={minute}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-stone-400"
                  style={{ top: (minute - openMinute) * scale }}
                >
                  {minutesToTime(minute)}
                </div>
              ))}
            </div>

            {agenda.barbers.map((barber) => (
              <div
                key={barber.id}
                className="relative min-w-[200px] flex-1 border-l border-line"
                style={{ height }}
              >
                {hourMarks.map((minute) => (
                  <div
                    key={minute}
                    className="absolute inset-x-0 border-t border-line/70"
                    style={{ top: (minute - openMinute) * scale }}
                  />
                ))}

                {isToday &&
                  nowMinutes >= openMinute &&
                  nowMinutes <= closeMinute && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20"
                      style={{ top: (nowMinutes - openMinute) * scale }}
                    >
                      <div className="relative border-t border-copper">
                        <span className="absolute -left-1 -top-1 size-2 rounded-full bg-copper" />
                      </div>
                    </div>
                  )}

                {barber.appointments.length === 0 && (
                  <p className="absolute inset-x-0 top-4 text-center text-[11px] text-stone-300">
                    Sin turnos
                  </p>
                )}

                {barber.appointments.map((appointment) => {
                  const startMinute = minutesOfDay(
                    new Date(appointment.start),
                    tz,
                  );
                  const endMinute = minutesOfDay(new Date(appointment.end), tz);
                  const top = Math.max(
                    0,
                    (startMinute - openMinute) * scale,
                  );
                  const blockHeight = Math.max(
                    30,
                    (endMinute - startMinute) * scale - 3,
                  );
                  const cancelled =
                    appointment.status === "CANCELLED" ||
                    appointment.status === "NO_SHOW";

                  return (
                    <Link
                      key={appointment.id}
                      href={`/panel/citas/detalle?id=${appointment.id}`}
                      className={`absolute left-1.5 right-1.5 overflow-hidden rounded-lg border px-2 py-1.5 text-[11px] shadow-sm transition hover:z-10 hover:shadow-md ${
                        blockStyles[appointment.status] ??
                        "border-line bg-white"
                      }`}
                      style={{
                        top,
                        height: blockHeight,
                        borderLeftWidth: 3,
                        borderLeftColor: barber.color,
                      }}
                      title={`${appointment.clientName} · ${appointment.serviceName}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold tabular-nums text-stone-500">
                          {formatTime(new Date(appointment.start), tz)} —{" "}
                          {formatTime(new Date(appointment.end), tz)}
                        </span>
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${
                            appointment.status === "CONFIRMED"
                              ? "bg-emerald-500"
                              : appointment.status === "PENDING"
                                ? "bg-amber-500"
                                : appointment.status === "COMPLETED"
                                  ? "bg-stone-400"
                                  : "bg-rose-400"
                          }`}
                        />
                      </div>
                      <p
                        className={`truncate font-semibold ${cancelled ? "line-through" : ""}`}
                      >
                        {appointment.clientName}
                      </p>
                      {blockHeight > 48 && (
                        <p className="truncate text-[10px] text-stone-500">
                          {appointment.serviceName}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {!closed && (
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" /> Confirmado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" /> Pendiente
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-stone-400" /> Completado
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-400" /> Cancelado / no
            vino
          </span>
          {isToday && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-4 bg-copper" /> Ahora
            </span>
          )}
        </div>
      )}
    </div>
  );
}
