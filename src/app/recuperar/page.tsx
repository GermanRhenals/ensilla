"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { Logo } from "@/components/ui/logo";
import { recoveryRedirectUrl } from "@/lib/recovery";
import { supabase } from "@/lib/supabase";

/**
 * Solicitud del enlace de recuperación.
 *
 * Supabase responde igual exista o no la cuenta, así que la pantalla confirma
 * el envío sin revelar si el correo está registrado.
 */
export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: recoveryRedirectUrl() },
    );

    setLoading(false);

    if (authError) {
      setError(
        authError.status === 429
          ? "Pediste varios enlaces seguidos. Esperá un minuto y probá de nuevo."
          : "No pudimos enviar el enlace. Revisá tu conexión e intentá otra vez.",
      );
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-sm">
        <Logo />

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Recuperar acceso
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Olvidé mi contraseña
        </h1>

        {sent ? (
          <>
            <Flash
              ok="Si el correo está registrado, te enviamos un enlace para elegir una contraseña nueva."
              className="mt-5"
            />
            <p className="mt-4 text-sm leading-relaxed text-stone-500">
              Revisá también la carpeta de spam. El enlace vence en una hora y
              se puede usar una sola vez.
            </p>
            <Link href="/login" className="btn-primary mt-6 w-full py-3">
              <ArrowLeft className="size-4" />
              Volver al ingreso
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-stone-500">
              Escribí el correo de tu cuenta y te enviamos un enlace para
              restablecerla.
            </p>

            <Flash error={error ?? undefined} className="mt-5" />

            <form className="mt-5 space-y-4" onSubmit={submit}>
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input"
                  placeholder="vos@ensilla.app"
                  autoComplete="email"
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
                  <Mail className="size-4" />
                )}
                Enviar enlace
              </button>
            </form>

            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Volver al ingreso
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
