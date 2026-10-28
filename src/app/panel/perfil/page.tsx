"use client";

import { useState, type FormEvent } from "react";
import {
  KeyRound,
  Loader2,
  LogOut,
  Palette,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import { normalizePhone } from "@/lib/phone";
import {
  fetchBarberCompletedCount,
  fetchShop,
  updateProfile,
} from "@/lib/data";
import { formatDate } from "@/lib/datetime";
import { initials } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useAsync } from "@/lib/use-async";

export default function ProfilePage() {
  const { profile: user, signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data, reload, error: loadError } = useAsync(async () => {
    if (!user) return null;
    const [shop, completed] = await Promise.all([
      fetchShop(),
      fetchBarberCompletedCount(user.id),
    ]);
    return { shop, completed };
  }, `profile-${user?.id ?? ""}`);

  if (loadError) return <Flash error={loadError} />;
  if (!user || !data) return null;
  const currentUser = user;
  const { shop, completed } = data;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    try {
      await updateProfile(currentUser.id, {
        name: String(formData.get("name") || ""),
        phone: normalizePhone(String(formData.get("phone") || "")),
        bio: String(formData.get("bio") || ""),
        color: String(formData.get("color") || "#3f7d6c"),
      });
      if (password) {
        if (password.length < 6) {
          throw new Error("La contraseña debe tener al menos 6 caracteres.");
        }
        const { error: passwordError } = await supabase.auth.updateUser({
          password,
        });
        if (passwordError) throw new Error(passwordError.message);
      }
      setMessage("Perfil actualizado.");
      reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar el perfil.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Mi perfil
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Tu identidad en la barbería
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Así te ven tus clientes en la reserva online y en la agenda.
        </p>
      </div>

      <Flash ok={message ?? undefined} error={error ?? undefined} />

      <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <form
          key={`${user.id}-${user.name}`}
          onSubmit={save}
          className="card card-pad space-y-4"
        >
          <div className="flex items-center gap-3">
            <span
              className="flex size-14 items-center justify-center rounded-full font-display text-lg font-semibold"
              style={{
                backgroundColor: `${user.color}1f`,
                color: user.color,
              }}
            >
              {initials(user.name)}
            </span>
            <div>
              <p className="font-display text-lg font-semibold">{user.name}</p>
              <p className="text-xs text-stone-500">
                {user.role === "ADMIN" ? "Administrador" : "Barbero"} ·{" "}
                {user.email}
              </p>
            </div>
          </div>

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
                defaultValue={user.name}
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
                defaultValue={user.phone ?? ""}
                className="input"
                placeholder="300 555 0101"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="bio">
                Bio / especialidad
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={3}
                maxLength={300}
                defaultValue={user.bio ?? ""}
                className="textarea"
                placeholder="Contá qué te gusta hacer: clásicos, fades, barba..."
              />
              <p className="mt-1 text-[11px] text-stone-400">
                Aparece en la página de reservas para que el cliente te elija.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="color">
                <span className="inline-flex items-center gap-1.5">
                  <Palette className="size-3.5" />
                  Color en la agenda
                </span>
              </label>
              <input
                id="color"
                name="color"
                type="color"
                defaultValue={user.color}
                className="input h-11 p-1"
              />
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-copper" />
              <h2 className="font-semibold">Seguridad</h2>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="password">
                Nueva contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                minLength={6}
                className="input"
                placeholder="Dejar vacío para mantener la actual"
                autoComplete="new-password"
              />
              <p className="mt-1 text-[11px] text-stone-400">
                Mínimo 6 caracteres. La sesión actual sigue activa.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Guardar cambios
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="card card-pad">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Tu cuenta
            </p>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">Email</dt>
                <dd className="truncate font-medium">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">Rol</dt>
                <dd className="font-medium">
                  {user.role === "ADMIN" ? "Administrador" : "Barbero"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">En el equipo desde</dt>
                <dd className="font-medium">
                   {formatDate(
                     new Date(user.createdAt),
                     "d MMM yyyy",
                     shop.timezone,
                   )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-stone-500">Cortes completados</dt>
                <dd className="font-medium">{completed}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-sand/50 px-3 py-2.5 text-[11px] leading-relaxed text-stone-500">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-sage" />
              Tu email y tu rol solo pueden cambiarlos desde el equipo de
              administración.
            </p>
          </div>

          <div className="card card-pad">
            <p className="text-sm font-semibold">Cerrar sesión</p>
            <p className="mt-1 text-xs text-stone-500">
              Vas a volver a la pantalla de ingreso. Podés entrar de nuevo
              cuando quieras.
            </p>
            <button
              type="button"
              onClick={async () => {
                await signOut();
              }}
              className="btn-secondary mt-3 w-full"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
