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
  MapPin,
  MessageCircle,
  Scissors,
  UserRound,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchConfirmation, fetchShop } from "@/lib/data";
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
  const [error, setError] = useState<string | null>(null);

  const { data } = useAsync(async () => {
    if (!id) return null;
    const [shop, booking] = await Promise.all([
      fetchShop(),
      fetchConfirmation(id),
    ]);
    return { shop, booking };
  }, `confirmation-${id}`);

  if (!data) {
    return (
      <div className="flex justify-center py-24 text-stone-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const { shop, booking } = data;
  if (!booking) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">
          No encontramos esa reserva.
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Revisá el enlace o volvé a reservar tu turno.
        </p>
        <Link href="/reservar" className="btn-primary mt-5 inline-flex">
          Reservar de nuevo
        </Link>
      </div>
    );
  }

  const confirmed = booking;
  const start = new Date(confirmed.start_at);
  const end = new Date(confirmed.end_at);
  const tz = shop.timezone;

  function addToCalendar() {
    try {
      downloadIcs(
        buildIcs({
          id: confirmed.id,
          start,
          end,
          title: `${confirmed.service.name} · ${shop.name}`,
          description: `Turno de ${confirmed.client.name} con ${confirmed.barber.name}.`,
          location: shop.address ?? undefined,
        }),
        `turno-${confirmed.id.slice(0, 8)}.ics`,
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el calendario.",
      );
    }
  }

  return (
    <div className="container-page max-w-2xl py-10 sm:py-14">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage/15 text-sage">
          <Check className="size-7" />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Reserva confirmada
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Te esperamos, {booking.client.name.split(" ")[0]}.
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Guardá los detalles. Si necesitás cambiarla, escribinos por WhatsApp.
        </p>
      </div>

      {error && (
        <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </p>
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
              {formatMoney(booking.price_cents, shop.currency)}
            </p>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <UserRound className="size-4 text-copper" />
            <div className="flex-1">
              <p className="text-xs text-stone-400">Barbero</p>
              <p className="font-medium">{booking.barber.name}</p>
            </div>
            <p className="text-xs text-stone-500">
              {booking.service.duration_min} min
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

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={addToCalendar}
          className="btn-primary flex-1"
        >
          <Download className="size-4" />
          Agregar al calendario
        </button>
        <a
          href={whatsappLink(
            shop.whatsapp ?? shop.phone ?? "",
            `Hola! Reservé un turno para el ${formatDate(start, "d/M", tz)} a las ${formatTime(start, tz)}.`,
          )}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary flex-1"
        >
          <MessageCircle className="size-4" />
          Escribir por WhatsApp
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-stone-400">
        ¿Necesitás otro turno?{" "}
        <Link href="/reservar" className="font-medium text-copper">
          Reservá de nuevo
        </Link>
        {" · "}
        <Link href="/" className="font-medium text-copper">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
