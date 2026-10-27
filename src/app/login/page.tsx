import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, LockKeyhole, Scissors } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { DemoLogin } from "@/components/auth/demo-login";
import { Flash } from "@/components/ui/flash";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Ingresar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-ink p-10 text-cream lg:flex lg:flex-col lg:justify-between">
        <div className="hero-grain absolute inset-0 opacity-80" />
        <Scissors
          className="absolute -right-16 bottom-0 size-96 rotate-12 text-white/[0.04]"
          strokeWidth={0.7}
        />
        <div className="relative">
          <Logo className="text-cream" />
        </div>
        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber">
            Panel de operación
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight font-semibold">
            La barbería ordenada.
            <br />
            La memoria intacta.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-cream/60">
            Agenda del día, turnos, clientes y preferencias en un mismo lugar.
            Menos espera, más conversación.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-cream/70">
            {[
              "Agenda diaria por barbero",
              "Ficha con historial y preferencias",
              "Ideas para el próximo corte",
              "Estadísticas simples y claras",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-amber/15 text-amber">
                  <Check className="size-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-cream/35">
          En-silla · Cortes con memoria
        </p>
      </div>

      <div className="flex items-center justify-center bg-cream px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            Acceso del equipo
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Bienvenido de nuevo
          </h2>
          <p className="mt-1.5 text-sm text-stone-500">
            Ingresá con tu cuenta para abrir la agenda de hoy.
          </p>

          <Flash error={params.error} className="mt-5" />

          <form id="login-form" action={loginAction} className="mt-5 space-y-4">
            <input type="hidden" name="next" value={params.next ?? "/panel"} />
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={params.email ?? ""}
                className="input"
                placeholder="vos@ensilla.app"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full py-3">
              <LockKeyhole className="size-4" />
              Entrar al panel
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-line bg-white/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              Cuentas demo
            </p>
            <div className="mt-2 space-y-1 text-xs text-stone-500">
              <p>
                Admin:{" "}
                <span className="font-mono text-ink">admin@ensilla.app</span> /{" "}
                <span className="font-mono text-ink">admin123</span>
              </p>
              <p>
                Barbero:{" "}
                <span className="font-mono text-ink">bruno@ensilla.app</span> /{" "}
                <span className="font-mono text-ink">barber123</span>
              </p>
            </div>
            <DemoLogin
              accounts={[
                {
                  label: "admin",
                  email: "admin@ensilla.app",
                  password: "admin123",
                },
                {
                  label: "Bruno",
                  email: "bruno@ensilla.app",
                  password: "barber123",
                },
              ]}
            />
          </div>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
}
