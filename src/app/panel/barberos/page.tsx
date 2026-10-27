"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Power, UserCog } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBarberWorkload,
  fetchBarbers,
  toggleBarber,
} from "@/lib/data";
import { initials } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

export default function BarbersPage() {
  const { profile: admin } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, reload } = useAsync(async () => {
    const [barbers, workload] = await Promise.all([
      fetchBarbers(),
      fetchBarberWorkload(),
    ]);
    return {
      barbers: barbers
        .filter((barber) => barber.role === "ADMIN" || barber.role === "BARBER")
        .sort(
          (a, b) =>
            Number(b.active) - Number(a.active) ||
            a.name.localeCompare(b.name),
        )
        .map((barber) => ({
          ...barber,
          appointmentCount: workload.get(barber.id) ?? 0,
        })),
    };
  }, "barbers");

  if (!admin || !data) return null;
  if (admin.role !== "ADMIN") {
    return <Flash error="Solo un administrador puede ver esta sección." />;
  }
  const { barbers } = data;

  async function changeAccess(id: string, active: boolean) {
    setMessage(null);
    setError(null);
    try {
      await toggleBarber(id, active);
      setMessage(active ? "Acceso reactivado." : "Acceso desactivado.");
      reload();
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "No se pudo actualizar el acceso.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            Equipo
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Barberos y accesos
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Cada integrante tiene su agenda, su color y su propia cuenta.
          </p>
        </div>
        <Link href="/panel/barberos/nuevo" className="btn-primary self-start">
          <Plus className="size-4" />
          Nuevo integrante
        </Link>
      </div>

      <Flash ok={message ?? undefined} error={error ?? undefined} />

      <div className="grid gap-4 md:grid-cols-2">
        {barbers.map((barber) => {
          const isSelf = barber.id === admin.id;
          return (
            <div
              key={barber.id}
              className={`card card-pad ${barber.active ? "" : "bg-stone-50/70 opacity-80"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-12 items-center justify-center rounded-full font-display text-sm font-semibold"
                    style={{
                      backgroundColor: `${barber.color}1f`,
                      color: barber.color,
                    }}
                  >
                    {initials(barber.name)}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-semibold">
                        {barber.name}
                      </p>
                      {isSelf && (
                        <span className="badge bg-ink text-cream ring-transparent">
                          Vos
                        </span>
                      )}
                      {!barber.active && (
                        <span className="badge bg-stone-100 text-stone-500 ring-stone-200">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                      {barber.role === "ADMIN" ? "Administrador" : "Barbero"}
                    </p>
                  </div>
                </div>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => changeAccess(barber.id, !barber.active)}
                    className="flex size-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-sand hover:text-ink"
                    title={
                      barber.active ? "Desactivar acceso" : "Reactivar acceso"
                    }
                  >
                    <Power className="size-4" />
                  </button>
                )}
              </div>

              <p className="mt-3 min-h-10 text-sm leading-relaxed text-stone-500">
                {barber.bio ?? "Sin descripción."}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-stone-500">
                <span className="chip">{barber.email}</span>
                {barber.phone && <span className="chip">{barber.phone}</span>}
                <span className="chip">
                  {barber.appointmentCount} turnos históricos
                </span>
              </div>

              <div className="mt-4 flex justify-end border-t border-line pt-3">
                <Link
                  href={`/panel/barberos/detalle?id=${barber.id}`}
                  className="btn-secondary btn-sm"
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-stone-500">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <UserCog className="size-4 text-copper" />
          Sobre los accesos
        </p>
        <p className="mt-1.5">
          Los administradores pueden ver todo el equipo, gestionar servicios,
          barberos y ajustes. Los barberos solo ven su propia agenda y sus
          clientes, pero pueden consultar fichas y estadísticas propias.
        </p>
      </div>
    </div>
  );
}
