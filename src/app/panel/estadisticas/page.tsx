"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Loader2,
  Repeat2,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/lib/auth-context";
import { statusInfo } from "@/lib/constants";
import { fetchShop } from "@/lib/data";
import { formatMoney, initials } from "@/lib/format";
import { getOverview } from "@/lib/stats";
import { useAsync } from "@/lib/use-async";

const ranges = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

export default function StatsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <StatsContent />
    </Suspense>
  );
}

function StatsContent() {
  const params = useSearchParams();
  const { profile: user } = useAuth();
  const requested = Number(params.get("range"));
  const days = ranges.some((range) => range.days === requested)
    ? requested
    : 30;

  const { data } = useAsync(async () => {
    const [shop, overview] = await Promise.all([
      fetchShop(),
      getOverview({
        days,
        barberId: user?.role === "ADMIN" ? undefined : user?.id,
      }),
    ]);
    return { shop, overview };
  }, `stats-${days}-${user?.id ?? ""}`);

  if (!user || !data) return null;
  const { shop, overview } = data;

  const maxDaily = Math.max(1, ...overview.daily.map((day) => day.count));
  const maxService = Math.max(
    1,
    ...overview.topServices.map((service) => service.count),
  );
  const maxBarber = Math.max(
    1,
    ...overview.topBarbers.map((barber) => barber.count),
  );
  const maxHour = Math.max(1, ...overview.hours.map((hour) => hour.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            Estadísticas
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {user.role === "ADMIN"
              ? "Cómo viene la barbería"
              : "Tu rendimiento"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Números claros para tomar mejores decisiones, sin planillas.
          </p>
        </div>
        <div className="flex gap-1.5">
          {ranges.map((range) => (
            <Link
              key={range.days}
              href={`/panel/estadisticas?range=${range.days}`}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                days === range.days
                  ? "border-ink bg-ink text-cream"
                  : "border-line bg-white text-stone-500 hover:text-ink"
              }`}
            >
              {range.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos"
          value={formatMoney(overview.revenueCents, shop.currency)}
          hint={`${overview.completed} cortes completados`}
          icon={<Banknote className="size-4" />}
          tone="copper"
        />
        <StatCard
          label="Ticket promedio"
          value={formatMoney(overview.avgTicketCents, shop.currency)}
          hint="Por visita completada"
          icon={<TrendingUp className="size-4" />}
        />
        <StatCard
          label="Clientes atendidos"
          value={overview.uniqueClients}
          hint={`${overview.newClients} nuevos en el período`}
          icon={<Users className="size-4" />}
          tone="sage"
        />
        <StatCard
          label="Retención"
          value={`${Math.round(overview.retentionRate)}%`}
          hint={`${overview.returningClients} clientes volvieron`}
          icon={<Repeat2 className="size-4" />}
          tone="ink"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="card card-pad">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Cortes por día</h2>
              <p className="text-xs text-stone-500">
                Últimos {overview.days} días · ingresos{" "}
                {formatMoney(overview.revenueCents, shop.currency)}
              </p>
            </div>
            <CheckCircle2 className="size-4 text-sage" />
          </div>

          <div className="mt-5 flex h-44 items-end gap-[3px]">
            {overview.daily.map((day) => (
              <div
                key={day.key}
                className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${day.label}: ${day.count} cortes · ${formatMoney(day.revenueCents, shop.currency)}`}
              >
                <div
                  className={`w-full rounded-t-[3px] transition group-hover:bg-copper ${
                    day.count === 0 ? "bg-sand" : "bg-copper/70"
                  }`}
                  style={{
                    height: `${Math.max(day.count === 0 ? 2 : 8, (day.count / maxDaily) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-stone-400">
            {overview.daily
              .filter(
                (_, index) =>
                  index === 0 ||
                  index === overview.daily.length - 1 ||
                  index % Math.ceil(overview.daily.length / 5) === 0,
              )
              .map((day) => (
                <span key={day.key} className="capitalize">
                  {day.label}
                </span>
              ))}
          </div>
        </section>

        <section className="card card-pad">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Horarios más pedidos</h2>
              <p className="text-xs text-stone-500">Cortes completados</p>
            </div>
            <Clock3 className="size-4 text-copper" />
          </div>

          <div className="mt-5 flex h-36 items-end gap-1">
            {overview.hours.map((hour) => (
              <div
                key={hour.hour}
                className="group flex h-full flex-1 flex-col justify-end"
                title={`${hour.hour}:00 · ${hour.count} cortes`}
              >
                <div
                  className={`w-full rounded-t-[3px] ${hour.count > 0 ? "bg-ink/75 transition group-hover:bg-copper" : "bg-sand"}`}
                  style={{
                    height: `${Math.max(hour.count === 0 ? 2 : 6, (hour.count / maxHour) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-stone-400">
            <span>8:00</span>
            <span>14:00</span>
            <span>21:00</span>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="font-semibold">Servicios más pedidos</h2>
          <p className="text-xs text-stone-500">Por cantidad de cortes</p>

          <div className="mt-4 space-y-3">
            {overview.topServices.map((service, index) => (
              <div key={service.name}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-xs text-stone-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {service.name}
                  </span>
                  <span className="text-xs text-stone-400">
                    {service.count} ·{" "}
                    {formatMoney(service.revenueCents, shop.currency)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full rounded-full bg-copper"
                    style={{
                      width: `${(service.count / maxService) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {overview.topServices.length === 0 && (
              <p className="text-sm text-stone-500">
                Todavía no hay cortes completados en el período.
              </p>
            )}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="font-semibold">
            {user.role === "ADMIN" ? "Rendimiento por barbero" : "Tus visitas"}
          </h2>
          <p className="text-xs text-stone-500">Cortes completados</p>

          <div className="mt-4 space-y-3">
            {overview.topBarbers.map((barber, index) => (
              <div key={barber.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="flex size-6 items-center justify-center rounded-full text-[9px] font-semibold"
                      style={{
                        backgroundColor: `${barber.color}1f`,
                        color: barber.color,
                      }}
                    >
                      {initials(barber.name)}
                    </span>
                    {barber.name}
                  </span>
                  <span className="text-xs text-stone-400">
                    {barber.count} ·{" "}
                    {formatMoney(barber.revenueCents, shop.currency)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(barber.count / maxBarber) * 100}%`,
                      backgroundColor: barber.color,
                    }}
                  />
                </div>
                {index === 0 && user.role === "ADMIN" && (
                  <p className="mt-1 text-[10px] text-stone-400">
                    Más cortes del período
                  </p>
                )}
              </div>
            ))}
            {overview.topBarbers.length === 0 && (
              <p className="text-sm text-stone-500">
                Sin datos para el período.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-sage">
            <CheckCircle2 className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Completados
            </p>
            <p className="font-display text-xl font-semibold">
              {overview.completed}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <XCircle className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Cancelados
            </p>
            <p className="font-display text-xl font-semibold">
              {overview.cancellations}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-500">
            <UserPlus className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              No vinieron
            </p>
            <p className="font-display text-xl font-semibold">
              {overview.noShows}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          Distribución por estado
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(overview.statusCounts).map(([status, count]) => (
            <span
              key={status}
              className={`badge ${statusInfo(status).badge}`}
            >
              {statusInfo(status).label}: {count}
            </span>
          ))}
          {Object.keys(overview.statusCounts).length === 0 && (
            <span className="text-sm text-stone-500">Sin turnos todavía.</span>
          )}
        </div>
      </div>
    </div>
  );
}
