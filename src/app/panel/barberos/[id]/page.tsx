import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { updateBarberAction } from "@/app/actions/barbers";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { initials } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Editar integrante",
};

export default async function EditBarberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const barber = await prisma.user.findUnique({ where: { id } });
  if (!barber) notFound();

  const isSelf = barber.id === admin.id;

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
        <div className="mt-3 flex items-center gap-3">
          <span
            className="flex size-11 items-center justify-center rounded-full font-display text-sm font-semibold"
            style={{
              backgroundColor: `${barber.color}1f`,
              color: barber.color,
            }}
          >
            {initials(barber.name)}
          </span>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {barber.name}
            </h1>
            <p className="text-sm text-stone-500">
              {barber.role === "ADMIN" ? "Administrador" : "Barbero"} ·{" "}
              {barber.email}
            </p>
          </div>
        </div>
      </div>

      <Flash ok={query.ok} error={query.error} />

      <form
        action={updateBarberAction}
        className="card card-pad max-w-2xl space-y-3.5"
      >
        <input type="hidden" name="id" value={barber.id} />
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Nombre y apellido
            </label>
            <input
              id="name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={barber.name}
              className="input"
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
              required
              defaultValue={barber.email}
              className="input"
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
              defaultValue={barber.phone ?? ""}
              className="input"
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
              defaultValue={barber.role}
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
              defaultValue={barber.color}
              className="input h-11 p-1"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Nueva contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={6}
              className="input"
              placeholder="Dejar vacío para no cambiar"
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
            defaultValue={barber.bio ?? ""}
            className="textarea"
          />
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-sand/30 px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={barber.active}
            disabled={isSelf}
            className="size-4 accent-copper"
          />
          Cuenta activa
          {isSelf && (
            <span className="text-xs text-stone-400">
              (no podés desactivar tu propia cuenta)
            </span>
          )}
        </label>

        {isSelf && (
          <p className="rounded-xl bg-amber/10 px-3.5 py-2.5 text-xs text-stone-600">
            No podés quitarte el rol de administrador a vos mismo. Pedile a otro
            administrador si necesitás cambiar tu acceso.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" className="btn-primary">
            <Save className="size-4" />
            Guardar cambios
          </button>
          <Link href="/panel/barberos" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
