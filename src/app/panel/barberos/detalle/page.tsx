"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck, UserCog } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { fetchBarbers, updateBarber } from "@/lib/data";
import { initials } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

export default function BarberDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <BarberDetailContent />
    </Suspense>
  );
}

function BarberDetailContent() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { profile } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data, reload, error: loadError } = useAsync(async () => {
    if (!id) return null;
    const barbers = await fetchBarbers();
    return { barber: barbers.find((item) => item.id === id) ?? null };
  }, `barber-${id}`);

  if (loadError) return <Flash error={loadError} />;
  if (!profile || !data) return null;
  if (profile.role !== "ADMIN") {
    return <Flash error="Solo un administrador puede ver esta sección." />;
  }
  if (!data.barber) {
    return (
      <div className="card card-pad text-center text-sm text-stone-500">
        No encontramos ese integrante.
      </div>
    );
  }

  const { barber } = data;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    try {
      await updateBarber({
        id: barber.id,
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        ...(password ? { password } : {}),
        phone: normalizePhone(String(formData.get("phone") || "")),
        bio: String(formData.get("bio") || ""),
        color: String(formData.get("color") || "#3f7d6c"),
        role: String(formData.get("role")) === "ADMIN" ? "ADMIN" : "BARBER",
        active: formData.get("active") === "on",
      });
      setMessage("Integrante actualizado.");
      reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el integrante.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/panel/barberos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Volver al equipo
      </Link>

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
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {barber.name}
          </h1>
          <p className="text-xs uppercase tracking-[0.14em] text-stone-400">
            {barber.role === "ADMIN" ? "Administrador" : "Barbero"}
          </p>
        </div>
      </div>

      <Flash ok={message ?? undefined} error={error ?? undefined} />

      <form
        key={`${barber.id}-${barber.active}`}
        onSubmit={save}
        className="card card-pad space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              Nombre y apellido
            </label>
            <input
              id="name"
              name="name"
              defaultValue={barber.name}
              required
              minLength={2}
              maxLength={80}
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
              defaultValue={barber.email}
              required
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
              defaultValue={barber.phone ?? ""}
              maxLength={30}
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
              defaultValue={barber.role}
              className="select"
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
              minLength={MIN_PASSWORD_LENGTH}
              className="input"
              placeholder={`Dejar vacío para no cambiar. Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`}
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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={barber.active}
            className="size-4 rounded border-line accent-copper"
          />
          Acceso activo
        </label>

        <div className="flex items-start gap-2 rounded-xl bg-sand/50 px-3.5 py-3 text-xs text-stone-500">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-copper" />
          Cambiar el email o la contraseña afecta el acceso de esta persona al
          panel. Los turnos ya cargados se mantienen.
        </div>

        <div className="flex justify-end gap-2">
          <Link href="/panel/barberos" className="btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserCog className="size-4" />
            )}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
