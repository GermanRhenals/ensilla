"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Check,
  Clock,
  Download,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Scissors,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  fetchConfirmation,
  saveBookingEmail,
  sendBookingReminder,
} from "@/lib/data";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatMoney, whatsappLink } from "@/lib/format";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { useAsync } from "@/lib/use-async";

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}

function ConfirmationContent() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [pending, setPending] = useState<"email" | "reminder" | null>(null);

  const { data, error: loadError, loading } = useAsync(async () => {
    if (!id) return null;
    return fetchConfirmation(id);
  }, `confirmation-${id}`);

  // Sin identificador no hay nada que consultar: se responde de inmediato en
  // lugar de dejar un spinner infinito.
  if (!id) {
    return <BookingNotFound />;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-stone-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">
          No pudimos cargar la reserva.
        </h1>
        <p className="mt-2 text-sm text-stone-500">{loadError}</p>
        <Link href="/#buscar" className="btn-primary mt-5 inline-flex">
          Volver a buscar una barbería
        </Link>
      </div>
    );
  }

  if (!data) {
    return <BookingNotFound />;
  }

  const booking = data;
  const shop = booking.shop;
  const start = new Date(booking.start);
  const end = new Date(booking.end);
  const tz = shop.timezone;
  const hasEmail = booking.client.hasEmail || emailSaved;

  function addToCalendar() {
    setMessage(null);
    setError(null);
    try {
      downloadIcs(
        buildIcs({
          id: booking.id,
          start,
          end,
          title: `${booking.service.name} · ${shop.name}`,
          description: `Turno de ${booking.client.name} con ${booking.barber.name}.`,
          location: shop.address ?? undefined,
        }),
        `turno-${booking.id.slice(0, 8)}.ics`,
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el calendario.",
      );
    }
  }

  async function submitEmail() {
    setMessage(null);
    setError(null);

    const clean = email.trim();
    if (!clean) {
      setError("Ingresá tu correo.");
      return;
    }

    setPending("email");
    try {
      await saveBookingEmail(booking.id, clean);
      setEmailSaved(true);
      setEmail("");
      setMessage(
        "Correo guardado. Ya podés enviarte el recordatorio de la reserva.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el correo.",
      );
    } finally {
      setPending(null);
    }
  }

  async function sendReminder() {
    setMessage(null);
    setError(null);

    if (!hasEmail) {
      setError("Agregá tu correo primero para poder enviarte el recordatorio.");
      return;
    }

    setPending("reminder");
    try {
      await sendBookingReminder(booking.id);
      setMessage("Recordatorio enviado. Revisá tu correo.");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar el recordatorio.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="container-page max-w-2xl py-10 sm:py-14">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage/15 text-sage">
          <Check className="size-7" />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          {shop.name}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Se ha confirmado tu reserva.
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Te esperamos, {booking.client.name.split(" ")[0]}. Guardá los detalles
          o envíate un recordatorio por correo.
        </p>
      </div>

      {(message || error) && (
        <div className="mt-5 space-y-2">
          {message && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="card mt-7 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              {formatDate(start, "EEEE d 'de' MMMM", tz)}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tracking-tight">
              {formatTime(start, tz)} — {formatTime(end, tz)}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="divide-y divide-line">
          <div className="flex items-center gap-3 px-5 py-4">
            <Scissors className="size-4 text-copper" />
            <div className="flex-1">
              <p className="text-xs text-stone-400">Servicio</p>
              <p className="font-medium">{booking.service.name}</p>
            </div>
            <p className="text-sm font-semibold">
              {formatMoney(booking.priceCents, shop.currency, shop.locale)}
            </p>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <UserRound className="size-4 text-copper" />
            <div className="flex-1">
              <p className="text-xs text-stone-400">Barbero</p>
              <p className="font-medium">{booking.barber.name}</p>
            </div>
            <p className="text-xs text-stone-500">
              {booking.service.durationMin} min
            </p>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <CalendarDays className="size-4 text-copper" />
            <div className="flex-1">
              <p className="text-xs text-stone-400">Duración</p>
              <p className="font-medium">
                {formatTime(start, tz)} a {formatTime(end, tz)}
              </p>
            </div>
          </div>
          {shop.address && (
            <div className="flex items-center gap-3 px-5 py-4">
              <MapPin className="size-4 text-copper" />
              <div className="flex-1">
                <p className="text-xs text-stone-400">Dónde</p>
                <p className="font-medium">{shop.address}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 px-5 py-4">
            <Clock className="size-4 text-copper" />
            <div className="flex-1">
              <p className="text-xs text-stone-400">Se abona</p>
              <p className="font-medium">En el local</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-5 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-copper-soft text-copper-dark">
            <Mail className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Recordatorio por correo</p>
            {hasEmail ? (
              <p className="mt-1 text-sm text-stone-500">
                Tu reserva tiene un correo asociado. Podés enviarte el
                recordatorio ahora mismo.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-stone-500">
                  Es opcional. Si agregás tu correo, podemos avisarte antes del
                  turno.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    maxLength={160}
                    className="input flex-1"
                    placeholder="vos@email.com"
                    autoComplete="email"
                    aria-label="Correo para el recordatorio"
                  />
                  <button
                    type="button"
                    onClick={submitEmail}
                    disabled={pending !== null}
                    className="btn-secondary shrink-0"
                  >
                    {pending === "email" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    Guardar correo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={sendReminder}
          disabled={pending !== null || !hasEmail}
          className="btn-primary flex-1"
        >
          {pending === "reminder" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar recordatorio
        </button>
        <Link href="/" className="btn-secondary flex-1">
          <X className="size-4" />
          Cerrar
        </Link>
      </div>

      {!hasEmail && (
        <p className="mt-2 text-center text-[11px] text-stone-400">
          Agregá tu correo para habilitar el envío del recordatorio.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={addToCalendar}
          className="btn-ghost flex-1"
        >
          <Download className="size-4" />
          Agregar al calendario
        </button>
        {shop.whatsapp && (
          <a
            href={whatsappLink(
              shop.whatsapp,
              `Hola! Reservé un turno para el ${formatDate(start, "d/M", tz)} a las ${formatTime(start, tz)}.`,
              shop.whatsappCountryCode,
            )}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex-1"
          >
            <MessageCircle className="size-4" />
            Escribir por WhatsApp
          </a>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-stone-400">
        ¿Necesitás otro turno?{" "}
        <Link
          href={`/reservar?barberia=${encodeURIComponent(shop.slug)}`}
          className="font-medium text-copper"
        >
          Reservá de nuevo
        </Link>
        {" · "}
        <Link href="/#buscar" className="font-medium text-copper">
          Buscar otra barbería
        </Link>
      </p>
    </div>
  );
}

/** Estado único para enlaces incompletos o reservas inexistentes. */
function BookingNotFound() {
  return (
    <div className="container-page py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">
        No encontramos esa reserva.
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        Revisá el enlace o volvé a buscar tu barbería.
      </p>
      <Link href="/#buscar" className="btn-primary mt-5 inline-flex">
        Buscar una barbería
      </Link>
    </div>
  );
}
