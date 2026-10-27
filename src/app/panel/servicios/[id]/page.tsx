import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { updateServiceAction } from "@/app/actions/services";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Editar servicio",
};

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query, shop] = await Promise.all([
    params,
    searchParams,
    getShop(),
  ]);
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/panel/servicios"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Volver a servicios
        </Link>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
          Editar {service.name}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Los cambios se reflejan en la agenda y en la reserva online.
        </p>
      </div>

      <Flash ok={query.ok} error={query.error} />

      <form
        action={updateServiceAction}
        className="card card-pad max-w-xl space-y-4"
      >
        <input type="hidden" name="id" value={service.id} />

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
            defaultValue={service.name}
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
            rows={3}
            maxLength={300}
            defaultValue={service.description ?? ""}
            className="textarea"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
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

        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-sand/30 px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={service.active}
            className="size-4 accent-copper"
          />
          Servicio activo para reservas online
        </label>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary">
            <Save className="size-4" />
            Guardar cambios
          </button>
          <Link href="/panel/servicios" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
