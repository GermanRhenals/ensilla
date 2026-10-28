"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, LockKeyhole } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { Logo } from "@/components/ui/logo";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

type Phase = "checking" | "ready" | "invalid" | "done";

function ResetForm() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // El cliente de Supabase tiene `detectSessionInUrl` desactivado, así que el
  // enlace de recuperación se procesa acá. Se aceptan las dos formas que puede
  // usar Supabase: tokens en el hash o un código PKCE en la query.
  useEffect(() => {
    let active = true;

    async function establish() {
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const hashError = hash.get("error_description") ?? hash.get("error");
        const code = searchParams.get("code");

        if (accessToken || refreshToken || code || hashError) {
          // Los tokens no deben quedar en la barra de direcciones ni en el
          // historial del navegador.
          window.history.replaceState(null, "", window.location.pathname);
        }

        if (hashError) {
          if (active) setPhase("invalid");
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!active) return;
          setPhase(sessionError ? "invalid" : "ready");
          return;
        }

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!active) return;
          setPhase(exchangeError ? "invalid" : "ready");
          return;
        }

        // Sin tokens, solo se permite cambiar la contraseña si ya hay una
        // sesión válida en este navegador.
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setPhase(data.session ? "ready" : "invalid");
      } catch {
        if (active) setPhase("invalid");
      }
    }

    establish();
    return () => {
      active = false;
    };
  }, [searchParams]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(
        "No pudimos cambiar la contraseña. Pedí un enlace nuevo e intentá otra vez.",
      );
      return;
    }

    // La sesión de recuperación ya cumplió su función: se cierra para que la
    // persona ingrese con la contraseña nueva.
    await supabase.auth.signOut();
    setPhase("done");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-sm">
        <Logo />

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Contraseña nueva
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Elegí una contraseña
        </h1>

        {phase === "checking" && (
          <div className="mt-8 flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="size-4 animate-spin" />
            Verificando el enlace...
          </div>
        )}

        {phase === "invalid" && (
          <>
            <Flash
              error="El enlace no es válido o ya venció. Los enlaces de recuperación se pueden usar una sola vez."
              className="mt-5"
            />
            <Link href="/recuperar" className="btn-primary mt-6 w-full py-3">
              Pedir un enlace nuevo
            </Link>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Volver al ingreso
            </Link>
          </>
        )}

        {phase === "ready" && (
          <>
            <p className="mt-1.5 text-sm text-stone-500">
              Ingresá la contraseña nueva dos veces para confirmarla.
            </p>

            <Flash error={error ?? undefined} className="mt-5" />

            <form className="mt-5 space-y-4" onSubmit={save}>
              <div>
                <label className="label" htmlFor="password">
                  Contraseña nueva
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label" htmlFor="confirmation">
                  Repetir contraseña
                </label>
                <input
                  id="confirmation"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full py-3"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LockKeyhole className="size-4" />
                )}
                Guardar contraseña
              </button>
            </form>
          </>
        )}

        {phase === "done" && (
          <>
            <Flash ok="Tu contraseña se actualizó." className="mt-5" />
            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-stone-500">
              <Check className="mt-0.5 size-4 shrink-0 text-sage" />
              Ingresá al panel con la contraseña nueva. Si no fuiste vos,
              avisale a un administrador de tu barbería.
            </p>
            <Link href="/login?reset=1" className="btn-primary mt-6 w-full py-3">
              Ingresar
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-cream text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
