"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MailCheck,
  Scissors,
} from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { Logo } from "@/components/ui/logo";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import {
  ShopSignupError,
  requestShopSignup,
  resendShopSignup,
} from "@/lib/data";

type View = "form" | "sent" | "resend";

/**
 * Alta autoservicio de una barbería.
 *
 * La cuenta nace inactiva y la barbería oculta: el dueño no entra al panel
 * hasta confirmar el correo. La pantalla no habla con tablas, solo con la Edge
 * Function `shop-signup`, que es la única puerta de creación de tenants.
 */
function SignupForm() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>(() =>
    searchParams.get("reenviar") === "1" ? "resend" : "form",
  );
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sentEmail, setSentEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"signup" | "resend" | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPendingEmail(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const ownerName = String(formData.get("ownerName") || "").trim();
    const cleanEmail = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmation = String(formData.get("confirmation") || "");

    if (name.length < 2) {
      setError("Ingresá el nombre de la barbería.");
      return;
    }
    if (ownerName.length < 2) {
      setError("Ingresá el nombre de quien va a administrar la cuenta.");
      return;
    }
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

    setPending("signup");
    try {
      await requestShopSignup({
        name,
        ownerName,
        email: cleanEmail,
        password,
        phone: phone || undefined,
      });
      setSentEmail(cleanEmail);
      setEmail(cleanEmail);
      setView("sent");
    } catch (signupError) {
      if (signupError instanceof ShopSignupError) {
        setError(signupError.message);
        if (signupError.code === "pending") setPendingEmail(cleanEmail);
      } else {
        setError("No pudimos completar el alta. Intentá de nuevo.");
      }
    } finally {
      setPending(null);
    }
  }

  async function resend(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    setNotice(null);

    const target = event
      ? String(new FormData(event.currentTarget).get("email") || "")
          .trim()
          .toLowerCase()
      : sentEmail;

    if (!target) {
      setError("Ingresá el correo con el que hiciste el alta.");
      return;
    }

    setPending("resend");
    try {
      await resendShopSignup(target);
      // La respuesta es uniforme a propósito: no confirma si el correo existe.
      setNotice(
        "Si el alta está pendiente, te enviamos un enlace nuevo. Revisá también la carpeta de spam.",
      );
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "No pudimos reenviar el enlace. Intentá más tarde.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="min-h-dvh bg-cream px-5 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="En-silla, inicio">
            <Logo />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-stone-500 transition hover:text-ink"
          >
            Ya tengo cuenta
          </Link>
        </div>

        {view === "form" && (
          <>
            <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              Alta de barbería
            </p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              Abrí tu barbería en En-silla.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
              Creá la cuenta del dueño y la agenda de tu local. La barbería queda
              en borrador hasta que cargues tus servicios, horarios y equipo.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                "Confirmás tu correo",
                "Cargás servicios y horarios",
                "Publicás y recibís reservas",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-xs text-stone-600"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[10px] font-semibold text-cream">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>

            <Flash ok={notice ?? undefined} error={error ?? undefined} className="mt-6" />

            {pendingEmail && (
              <button
                type="button"
                onClick={() => {
                  setView("resend");
                  setEmail(pendingEmail);
                  setError(null);
                }}
                className="mt-3 text-sm font-medium text-copper transition hover:text-ink"
              >
                Reenviar el enlace de confirmación
              </button>
            )}

            <form onSubmit={create} className="card card-pad mt-6 space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="name">
                    Nombre de la barbería
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    className="input"
                    placeholder="Barbería El Roble"
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ownerName">
                    Responsable
                  </label>
                  <input
                    id="ownerName"
                    name="ownerName"
                    required
                    minLength={2}
                    maxLength={80}
                    className="input"
                    placeholder="Nombre y apellido"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    Teléfono (opcional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    maxLength={40}
                    className="input"
                    placeholder="+57 320 ..."
                    autoComplete="tel"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="email">
                    Correo del dueño
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="input"
                    placeholder="vos@tubarberia.com"
                    autoComplete="email"
                  />
                  <p className="mt-1 text-[11px] text-stone-400">
                    Te enviamos un enlace para confirmar la cuenta. Sin ese paso
                    no se puede ingresar al panel.
                  </p>
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
                    minLength={MIN_PASSWORD_LENGTH}
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
                    name="confirmation"
                    type="password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    className="input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3"
                disabled={pending !== null}
              >
                {pending === "signup" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Scissors className="size-4" />
                )}
                Crear mi barbería
              </button>

              <p className="text-center text-xs leading-relaxed text-stone-400">
                Una cuenta administra una sola barbería. Si tu correo ya tiene
                una cuenta, ingresá al panel o recuperá tu contraseña.
              </p>
            </form>

            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Volver al sitio
            </Link>
          </>
        )}

        {view === "sent" && (
          <div className="mt-10">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-sage">
              <MailCheck className="size-6" />
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">
              Revisá tu correo.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
              Enviamos un enlace de confirmación a{" "}
              <span className="font-medium text-ink">{sentEmail}</span>. Al
              abrirlo se activa la cuenta del dueño y podés entrar al panel.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-stone-600">
              {[
                "El enlace vence en una hora y se puede usar una sola vez.",
                "Si no aparece, mirá en spam o promociones.",
                "La barbería queda oculta hasta que la publiques desde Ajustes.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-sage" />
                  {item}
                </li>
              ))}
            </ul>

            <Flash ok={notice ?? undefined} error={error ?? undefined} className="mt-6" />

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => resend()}
                className="btn-secondary flex-1"
                disabled={pending !== null}
              >
                {pending === "resend" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MailCheck className="size-4" />
                )}
                Reenviar el enlace
              </button>
              <Link href="/login" className="btn-primary flex-1">
                Ya confirmé, ingresar
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Volver al sitio
            </Link>
          </div>
        )}

        {view === "resend" && (
          <div className="mt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              Confirmación pendiente
            </p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              Reenviar el enlace.
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">
              Escribí el correo con el que hiciste el alta. Si falta confirmar,
              te enviamos un enlace nuevo.
            </p>

            <Flash ok={notice ?? undefined} error={error ?? undefined} className="mt-6" />

            <form onSubmit={resend} className="card card-pad mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="resend-email">
                  Correo
                </label>
                <input
                  id="resend-email"
                  name="email"
                  type="email"
                  required
                  maxLength={160}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input"
                  placeholder="vos@tubarberia.com"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full py-3"
                disabled={pending !== null}
              >
                {pending === "resend" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MailCheck className="size-4" />
                )}
                Enviar enlace nuevo
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-500">
              <Link
                href="/registro"
                className="inline-flex items-center gap-1.5 transition hover:text-ink"
              >
                <ArrowLeft className="size-4" />
                Volver al alta
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 transition hover:text-ink"
              >
                Ya confirmé, ingresar
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-cream text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
