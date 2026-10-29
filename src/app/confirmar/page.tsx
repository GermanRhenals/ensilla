"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MailCheck,
} from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { Logo } from "@/components/ui/logo";
import { supabase } from "@/lib/supabase";

type Phase = "checking" | "done" | "invalid";

/**
 * Confirmación del correo del dueño después del alta.
 *
 * El cliente de Supabase tiene `detectSessionInUrl: false`, así que el enlace
 * se procesa a mano: tokens en el hash (flujo implícito) o código PKCE en la
 * query. Con la sesión abierta se llama a `confirm_shop_signup`, que activa el
 * perfil pendiente; el trigger de Auth ya lo hace al confirmar el correo, pero
 * la RPC cubre cualquier carrera entre la verificación y la primera carga.
 */
function ConfirmationScreen() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("checking");
  const [message, setMessage] = useState<string | null>(null);

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
          if (sessionError) {
            setPhase("invalid");
            return;
          }
        } else if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (!active) return;
          if (exchangeError) {
            setPhase("invalid");
            return;
          }
        } else {
          const { data } = await supabase.auth.getSession();
          if (!active) return;
          if (!data.session) {
            setPhase("invalid");
            return;
          }
        }

        const { error: confirmError } = await supabase.rpc(
          "confirm_shop_signup",
        );
        if (!active) return;

        if (confirmError) {
          setMessage(confirmError.message);
          setPhase("invalid");
          return;
        }

        setPhase("done");
      } catch {
        if (active) setPhase("invalid");
      }
    }

    establish();
    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-md">
        <Logo />

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Confirmación de cuenta
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Tu barbería, lista para abrir.
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
              error={
                message ??
                "El enlace no es válido o ya venció. Los enlaces de confirmación se pueden usar una sola vez."
              }
              className="mt-5"
            />
            <p className="mt-4 text-sm leading-relaxed text-stone-500">
              Pedí un enlace nuevo con el correo del alta. Si el problema sigue,
              escribinos y revisamos la cuenta.
            </p>
            <Link
              href="/registro?reenviar=1"
              className="btn-primary mt-6 w-full py-3"
            >
              <MailCheck className="size-4" />
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

        {phase === "done" && (
          <>
            <Flash
              ok="Tu correo quedó confirmado y la cuenta del dueño está activa."
              className="mt-5"
            />
            <ul className="mt-4 space-y-2 text-sm text-stone-600">
              {[
                "Entrá al panel con el correo y la contraseña que elegiste.",
                "Cargá al menos un servicio, un día de atención y tu equipo.",
                "Publicá la barbería desde Ajustes para aparecer en el buscador.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-sage" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/panel" className="btn-primary mt-6 w-full py-3">
              Entrar al panel
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Volver al sitio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-cream text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <ConfirmationScreen />
    </Suspense>
  );
}
