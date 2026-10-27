import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, UserPlus } from "lucide-react";
import { createBarberAction } from "@/app/actions/barbers";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nuevo integrante",
};

export default async function NewBarberPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/panel/barberos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Volver al equipo
        </Link>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Nuevo integrante
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Sumar manos a la barbería
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Creá la cuenta para que pueda ingresar a su agenda.
        </p>
      </div>

      <Flash error={params.error} />

      <form
        action={createBarberAction}
        className="card card-pad max-w-2xl space-y-3.5"
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
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
            <label className="label" htmlFor="email">
              Email *
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input"
              placeholder="nombre@ensilla.app"
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Teléfono
            </label>
            <input
              id="phone"
              name="phone"
              maxLength={30}
              className="input"
              placeholder="11 5555-0101"
            />
          </div>
          <div>
            <label className="label" htmlFor="role">
              Rol
            </label>
            <select
              id="role"
              name="role"
              className="select"
              defaultValue="BARBER"
            >
              <option value="BARBER">Barbero</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="color">
              Color en la agenda
            </label>
            <input
              id="color"
              name="color"
              type="color"
              defaultValue="#3f7d6c"
              className="input h-11 p-1"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Contraseña inicial *
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="input"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="bio">
            Bio / especialidad
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            maxLength={300}
            className="textarea"
            placeholder="Clásicos, fades, rizos..."
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-sand/50 px-3.5 py-3 text-xs text-stone-500">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-copper" />
          Compartí la contraseña con la persona y pedile que la cambie desde
          “Mi perfil” la primera vez que ingrese.
        </div>

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary">
            <UserPlus className="size-4" />
            Crear integrante
          </button>
          <Link href="/panel/barberos" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
