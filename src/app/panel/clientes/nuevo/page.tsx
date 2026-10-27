"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, UserPlus } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import { normalizePhone } from "@/lib/booking";
import { createClientRecord, fetchPublicBarbers } from "@/lib/data";
import { useAsync } from "@/lib/use-async";

export default function NewClientPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { data } = useAsync(async () => {
    const barbers = await fetchPublicBarbers();
    return { barbers };
  }, "new-client");

  if (!profile || !data) return null;
  const { barbers } = data;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const phone = normalizePhone(String(formData.get("phone") || ""));
    if (phone.length < 6) {
      setError("Ingresá un teléfono válido.");
      setPending(false);
      return;
    }

    try {
      const id = await createClientRecord({
        name: String(formData.get("name") || ""),
        phone,
        email: String(formData.get("email") || ""),
        birthDate: String(formData.get("birthDate") || ""),
        preferredBarberId: String(formData.get("preferredBarberId") || ""),
        hairType: String(formData.get("hairType") || ""),
        preferredStyle: String(formData.get("preferredStyle") || ""),
        products: String(formData.get("products") || ""),
        allergies: String(formData.get("allergies") || ""),
        notes: String(formData.get("notes") || ""),
      });
      router.replace(`/panel/clientes/detalle?id=${id}&ok=Ficha creada.`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la ficha.",
      );
      setPending(false);
    }
  }

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

      <Flash error={error ?? undefined} />

      <form
        onSubmit={submit}
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
                  placeholder="300 555 0101"
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
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
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
