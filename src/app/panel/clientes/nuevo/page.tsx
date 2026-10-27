import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles, UserPlus } from "lucide-react";
import { createClientAction } from "@/app/actions/clients";
import { Flash } from "@/components/ui/flash";
import { requireUser } from "@/lib/auth";
import { getActiveBarbers } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Nuevo cliente",
};

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireUser();
  const barbers = await getActiveBarbers();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/panel/clientes"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Volver a clientes
        </Link>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Nueva ficha
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Conocer a alguien nuevo
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Cuanta más información, mejor la próxima visita.
        </p>
      </div>

      <Flash error={params.error} />

      <form
        action={createClientAction}
        className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="space-y-4">
          <section className="card card-pad">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-copper" />
              <h2 className="font-semibold">Datos de contacto</h2>
            </div>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="name">
                  Nombre y apellido *
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  className="input"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="label" htmlFor="phone">
                  Teléfono *
                </label>
                <input
                  id="phone"
                  name="phone"
                  required
                  minLength={6}
                  maxLength={30}
                  className="input"
                  placeholder="11 5555-0101"
                  inputMode="tel"
                />
              </div>
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  maxLength={160}
                  className="input"
                  placeholder="cliente@email.com"
                />
              </div>
              <div>
                <label className="label" htmlFor="birthDate">
                  Cumpleaños
                </label>
                <input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="preferredBarberId">
                  Barbero preferido
                </label>
                <select
                  id="preferredBarberId"
                  name="preferredBarberId"
                  className="select"
                  defaultValue=""
                >
                  <option value="">Sin preferencia</option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card card-pad">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-copper" />
              <h2 className="font-semibold">Preferencias y detalles</h2>
            </div>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="hairType">
                  Tipo de cabello
                </label>
                <input
                  id="hairType"
                  name="hairType"
                  maxLength={120}
                  className="input"
                  placeholder="Ondulado medio, liso fino..."
                />
              </div>
              <div>
                <label className="label" htmlFor="preferredStyle">
                  Estilo preferido
                </label>
                <input
                  id="preferredStyle"
                  name="preferredStyle"
                  maxLength={160}
                  className="input"
                  placeholder="Fade bajo con textura"
                />
              </div>
              <div>
                <label className="label" htmlFor="products">
                  Productos que usa
                </label>
                <input
                  id="products"
                  name="products"
                  maxLength={160}
                  className="input"
                  placeholder="Pomada mate, cera..."
                />
              </div>
              <div>
                <label className="label" htmlFor="allergies">
                  Alergias o cuidados
                </label>
                <input
                  id="allergies"
                  name="allergies"
                  maxLength={200}
                  className="input"
                  placeholder="Piel sensible, sin alcohol..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="notes">
                  Notas internas
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  maxLength={600}
                  className="textarea"
                  placeholder="Conversación, horarios preferidos, cosas que le gustan..."
                />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card card-pad">
            <h2 className="font-semibold">Listo para guardar</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-500">
              La ficha queda vinculada a futuras reservas por teléfono. Si el
              cliente reserva online con el mismo número, se actualiza sola.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="submit" className="btn-primary w-full">
                Crear ficha
              </button>
              <Link href="/panel/clientes" className="btn-secondary w-full">
                Cancelar
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-stone-500">
            <p className="font-semibold text-ink">Un detalle que suma</p>
            <p className="mt-1.5">
              Preguntá qué producto usa y qué no le gustó del último corte.
              Esa información vale más que cualquier foto.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
