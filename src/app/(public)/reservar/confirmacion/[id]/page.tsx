import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarPlus,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  Scissors,
  UserRound,
} from "lucide-react";
import {
  formatLongDate,
  formatTimeRange,
} from "@/lib/datetime";
import { formatMoney, whatsappLink } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getShop } from "@/lib/shop";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turno confirmado",
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [appointment, shop] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        service: true,
        barber: true,
      },
    }),
    getShop(),
  ]);

  if (!appointment) notFound();

  const message = `Hola ${shop.name}, reservé un turno para el ${formatLongDate(
    appointment.start,
    shop.timezone,
  )} a las ${formatTimeRange(
    appointment.start,
    appointment.end,
    shop.timezone,
  )}. Soy ${appointment.client.name}.`;

  return (
    <div className="bg-sand/40">
      <div className="container-page py-10 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-sage">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage">
                Reserva confirmada
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                Te esperamos, {appointment.client.name.split(" ")[0]}.
              </h1>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            <div className="border-b border-line bg-ink px-6 py-5 text-cream sm:px-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cream/40">
                {shop.name}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {formatLongDate(appointment.start, shop.timezone)}
              </p>
              <p className="mt-1 text-sm text-cream/60">
                {formatTimeRange(
                  appointment.start,
                  appointment.end,
                  shop.timezone,
                )}{" "}
                hs
              </p>
            </div>

            <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
              <div className="rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                  <Scissors className="size-3.5 text-copper" />
                  Servicio
                </p>
                <p className="mt-2 font-semibold">{appointment.service.name}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {appointment.service.durationMin} minutos ·{" "}
                  {formatMoney(appointment.priceCents, shop.currency)}
                </p>
              </div>

              <div className="rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                  <UserRound className="size-3.5 text-copper" />
                  Tu barbero
                </p>
                <p className="mt-2 font-semibold">{appointment.barber.name}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {appointment.barber.phone ?? "Te esperamos en el local"}
                </p>
              </div>

              <div className="rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                  <MapPin className="size-3.5 text-copper" />
                  Dónde
                </p>
                <p className="mt-2 font-semibold">
                  {shop.address ?? "En-silla Barbershop"}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Llegá 5 minutos antes.
                </p>
              </div>

              <div className="rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                  <Clock3 className="size-3.5 text-copper" />
                  Recordatorio
                </p>
                <p className="mt-2 font-semibold">Guardá el turno</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Agregalo a tu calendario con el botón de abajo.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-line px-6 py-5 sm:flex-row sm:px-8">
              <a
                href={`/api/turno/${appointment.id}/ics`}
                className="btn-dark flex-1"
              >
                <CalendarPlus className="size-4" />
                Agregar al calendario
              </a>
              {shop.whatsapp && (
                <a
                  href={whatsappLink(shop.whatsapp, message)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary flex-1"
                >
                  <MessageCircle className="size-4" />
                  Avisar por WhatsApp
                </a>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
            <p className="text-stone-500">
              ¿Necesitás cambiarlo? Escribinos por WhatsApp con anticipación.
            </p>
            <div className="flex gap-4">
              <Link href="/" className="link-muted">
                Volver al inicio
              </Link>
              <Link href="/reservar" className="link-muted">
                Reservar otro turno
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
