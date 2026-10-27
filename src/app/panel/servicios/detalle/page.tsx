"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Scissors } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import { fetchService, fetchShop, updateService } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

export default function ServiceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <ServiceDetailContent />
    </Suspense>
  );
}

function ServiceDetailContent() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { profile } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data, reload } = useAsync(async () => {
    if (!id) return null;
    const [shop, service] = await Promise.all([fetchShop(), fetchService(id)]);
    return { shop, service };
  }, `service-${id}`);

  if (!profile || !data) return null;
  if (profile.role !== "ADMIN") {
    return <Flash error="Solo un administrador puede ver esta sección." />;
  }
  if (!data.service) {
    return (
      <div className="card card-pad text-center text-sm text-stone-500">
        No encontramos ese servicio.
      </div>
    );
  }

  const { shop, service } = data;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      await updateService(service.id, {
        name: String(formData.get("name") || "").trim(),
        description:
          String(formData.get("description") || "").trim() || null,
        duration_min: Number(formData.get("durationMin") || 0),
        price_cents: Math.round(Number(formData.get("price") || 0) * 100),
        active: formData.get("active") === "on",
      });
      setMessage("Servicio actualizado.");
      reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el servicio.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/panel/servicios"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Volver a servicios
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-sand">
          <Scissors className="size-5 text-copper" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {service.name}
          </h1>
          <p className="text-xs text-stone-500">
            {service.durationMin} min ·{" "}
            {formatMoney(service.priceCents, shop.currency, shop.locale)}
          </p>
        </div>
      </div>

      <Flash ok={message ?? undefined} error={error ?? undefined} />

      <form key={service.id} onSubmit={save} className="card card-pad space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            defaultValue={service.name}
            required
            minLength={2}
            maxLength={80}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="description">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={service.description ?? ""}
            maxLength={300}
            rows={3}
            className="textarea"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="durationMin">
              Duración (minutos)
            </label>
            <input
              id="durationMin"
              name="durationMin"
              type="number"
              min={5}
              max={480}
              step={5}
              required
              defaultValue={service.durationMin}
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
              defaultValue={service.priceCents / 100}
              className="input"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={service.active}
            className="size-4 rounded border-line accent-copper"
          />
          Activo para reservas online
        </label>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
