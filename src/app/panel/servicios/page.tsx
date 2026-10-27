"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Archive, Loader2, Pencil, Plus, Scissors } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import {
  createService,
  fetchServices,
  fetchShop,
  toggleService,
} from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

export default function ServicesPage() {
  const { profile } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { data, reload } = useAsync(async () => {
    const [shop, services] = await Promise.all([
      fetchShop(),
      fetchServices(),
    ]);
    return { shop, services };
  }, "services");

  if (!profile || !data) return null;
  if (profile.role !== "ADMIN") {
    return <Flash error="Solo un administrador puede ver esta sección." />;
  }
  const { shop, services } = data;

  async function addService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      await createService({
        name: String(formData.get("name") || ""),
        description: String(formData.get("description") || ""),
        durationMin: Number(formData.get("durationMin") || 0),
        priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      });
      event.currentTarget.reset();
      setMessage("Servicio agregado.");
      reload();
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : "No se pudo agregar el servicio.",
      );
    } finally {
      setPending(false);
    }
  }

  async function changeActive(serviceId: string, active: boolean) {
    setMessage(null);
    setError(null);
    try {
      await toggleService(serviceId, active);
      setMessage(active ? "Servicio reactivado." : "Servicio archivado.");
      reload();
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "No se pudo actualizar el servicio.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Servicios
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Lo que ofrecemos
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Duración y precio se usan para calcular la agenda y las reservas
          online.
        </p>
      </div>

      <Flash ok={message ?? undefined} error={error ?? undefined} />

      <section className="card card-pad">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-copper" />
          <h2 className="font-semibold">Agregar servicio</h2>
        </div>
        <form
          onSubmit={addService}
          className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr_120px_140px_auto] sm:items-end"
        >
          <div>
            <label className="label" htmlFor="name">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              className="input"
              placeholder="Corte clásico"
            />
          </div>
          <div>
            <label className="label" htmlFor="description">
              Descripción
            </label>
            <input
              id="description"
              name="description"
              maxLength={300}
              className="input"
              placeholder="Tijera, máquina y peinado"
            />
          </div>
          <div>
            <label className="label" htmlFor="durationMin">
              Minutos
            </label>
            <input
              id="durationMin"
              name="durationMin"
              type="number"
              min={5}
              max={480}
              step={5}
              required
              defaultValue={45}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="price">
              Precio ({shop.currency})
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step={100}
              required
              className="input"
              placeholder="12000"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Agregar
          </button>
        </form>
      </section>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <p className="text-sm font-medium">
            {services.length} {services.length === 1 ? "servicio" : "servicios"}
          </p>
        </div>

        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-sand text-stone-500">
              <Scissors className="size-5" />
            </span>
            <p className="mt-3 font-medium">Todavía no hay servicios.</p>
            <p className="mt-1 text-sm text-stone-500">
              Agregá el primero desde el formulario de arriba.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {services.map((service, index) => (
              <div
                key={service.id}
                className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  service.active ? "" : "bg-stone-50/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-display text-sm text-stone-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{service.name}</p>
                      {!service.active && (
                        <span className="badge bg-stone-100 text-stone-500 ring-stone-200">
                          Archivado
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {service.description ?? "Sin descripción"}
                    </p>
                    <p className="mt-1 text-[11px] text-stone-400">
                      {service.durationMin} min ·{" "}
                      {formatMoney(service.priceCents, shop.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <Link
                    href={`/panel/servicios/detalle?id=${service.id}`}
                    className="btn-secondary btn-sm"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => changeActive(service.id, !service.active)}
                    className="btn-ghost btn-sm"
                  >
                    <Archive className="size-3.5" />
                    {service.active ? "Archivar" : "Reactivar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
