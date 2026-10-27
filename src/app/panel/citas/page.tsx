"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/lib/auth-context";
import {
  APPOINTMENT_STATUS_LIST,
  isValidStatus,
  statusInfo,
} from "@/lib/constants";
import { fetchAppointments, fetchShop } from "@/lib/data";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatMoney, initials } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const views = [
  { id: "upcoming", label: "Próximos" },
  { id: "today", label: "Hoy" },
  { id: "all", label: "Recientes" },
];

export default function AppointmentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <AppointmentsContent />
    </Suspense>
  );
}

function AppointmentsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile: user } = useAuth();
  const viewParam = params.get("view");
  const statusParam = params.get("status");
  const view = views.some((item) => item.id === viewParam)
    ? (viewParam as string)
    : "upcoming";
  const status =
    statusParam && isValidStatus(statusParam) ? statusParam : "";
  const query = (params.get("q") ?? "").trim();

  const { data } = useAsync(async () => {
    if (!user) return null;
    const shop = await fetchShop();
    const appointments = await fetchAppointments({
      view,
      status,
      barberId: user.role === "ADMIN" ? undefined : user.id,
      query,
      timezone: shop.timezone,
    });
    return { shop, appointments };
  }, `appointments-${user?.id ?? ""}-${view}-${status}-${query}`);

  if (!user || !data) return null;
  const { shop, appointments } = data;
  const tz = shop.timezone;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            Turnos
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Todos los movimientos
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Buscá, filtrá y abrí cada turno para ver el detalle del cliente.
          </p>
        </div>
        <Link href="/panel/citas/nueva" className="btn-primary self-start">
          <Plus className="size-4" />
          Nueva cita
        </Link>
      </div>

      <Flash
        ok={params.get("ok") ?? undefined}
        error={params.get("error") ?? undefined}
      />

      <div className="flex flex-wrap gap-1.5">
        {views.map((item) => (
          <Link
            key={item.id}
            href={`/panel/citas?view=${item.id}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              view === item.id
                ? "border-ink bg-ink text-cream"
                : "border-line bg-white text-stone-500 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const nextParams = new URLSearchParams();
          nextParams.set("view", String(formData.get("view") || view));
          const nextQuery = String(formData.get("q") || "").trim();
          const nextStatus = String(formData.get("status") || "");
          if (nextQuery) nextParams.set("q", nextQuery);
          if (nextStatus) nextParams.set("status", nextStatus);
          router.push(`/panel/citas?${nextParams.toString()}`);
        }}
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="view" value={view} />
        <div className="flex-1">
          <label className="label" htmlFor="q">
            Buscar
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Cliente, teléfono o servicio"
              className="input pl-9"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <label className="label" htmlFor="status">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="select"
          >
            <option value="">Todos</option>
            {APPOINTMENT_STATUS_LIST.map((item) => (
              <option key={item} value={item}>
                {statusInfo(item).label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            <SlidersHorizontal className="size-4" />
            Filtrar
          </button>
          {(query || status) && (
            <Link
              href={`/panel/citas?view=${view}`}
              className="btn-ghost"
            >
              Limpiar
            </Link>
          )}
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-medium">
            {appointments.length}{" "}
            {appointments.length === 1 ? "turno" : "turnos"}
          </p>
          <p className="text-xs text-stone-400">
            Ordenado por {view === "all" ? "más reciente" : "próximo"}
          </p>
        </div>

        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-sand text-stone-500">
              <CalendarDays className="size-5" />
            </span>
            <p className="mt-3 font-medium">No hay turnos con estos filtros.</p>
            <p className="mt-1 text-sm text-stone-500">
              Probá con otro estado o cargá un turno nuevo.
            </p>
            <Link href="/panel/citas/nueva" className="btn-primary mt-4">
              <Plus className="size-4" />
              Nueva cita
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/30 text-left text-[10px] uppercase tracking-[0.12em] text-stone-400">
                  <th className="px-4 py-2.5 font-semibold">Fecha</th>
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 font-semibold">Servicio</th>
                  <th className="px-4 py-2.5 font-semibold">Barbero</th>
                  <th className="px-4 py-2.5 font-semibold">Precio</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {appointments.map((appointment) => (
                  <tr
                    key={appointment.id}
                    className="transition hover:bg-sand/20"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-medium capitalize">
                        {formatDate(
                          new Date(appointment.start),
                          "EEE d MMM",
                          tz,
                        )}
                      </p>
                      <p className="text-xs tabular-nums text-stone-400">
                        {formatTime(new Date(appointment.start), tz)} –{" "}
                        {formatTime(new Date(appointment.end), tz)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/panel/clientes/detalle?id=${appointment.client?.id ?? ""}`}
                        className="font-medium hover:text-copper"
                      >
                        {appointment.client.name}
                      </Link>
                      <p className="text-xs text-stone-400">
                        {appointment.client.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {appointment.service.name}
                      <p className="text-xs text-stone-400">
                        {appointment.service.durationMin} min
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="flex size-5 items-center justify-center rounded-full text-[8px] font-semibold"
                          style={{
                            backgroundColor: `${appointment.barber.color}1f`,
                            color: appointment.barber.color,
                          }}
                        >
                          {initials(appointment.barber.name)}
                        </span>
                        {appointment.barber.name.split(" ")[0]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {formatMoney(appointment.priceCents, shop.currency, shop.locale)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appointment.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/panel/citas/detalle?id=${appointment.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-copper"
                      >
                        <CalendarClock className="size-3.5" />
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
