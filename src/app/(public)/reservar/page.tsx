"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AtSign,
  CalendarCheck,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
} from "lucide-react";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { ShopSearch } from "@/components/public/shop-search";
import {
  fetchBusinessHours,
  fetchPublicBarbers,
  fetchServices,
  fetchShopBySlug,
} from "@/lib/data";
import { nextDays } from "@/lib/datetime";
import { whatsappLink } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const params = useSearchParams();
  const slug = params.get("barberia") ?? "";
  const serviceId = params.get("service") ?? undefined;
  const barberId = params.get("barber") ?? undefined;

  const { data, error: loadError, loading } = useAsync(async () => {
    if (!slug) return null;

    const shop = await fetchShopBySlug(slug);
    if (!shop) return null;

    const [barbers, hours, services] = await Promise.all([
      fetchPublicBarbers(shop.id),
      fetchBusinessHours(shop.id),
      fetchServices(true, shop.id),
    ]);

    return { shop, barbers, hours, services };
  }, `booking-${slug}`);

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
          No pudimos cargar la agenda.
        </h1>
        <p className="mt-2 text-sm text-stone-500">{loadError}</p>
        <Link href="/#buscar" className="btn-primary mt-5 inline-flex">
          Buscar otra barbería
        </Link>
      </div>
    );
  }

  // Sin slug (o con uno inexistente) no hay agenda que mostrar. En vez de un
  // error seco, se ofrece la búsqueda para que el visitante retome el flujo.
  if (!data) {
    return (
      <div className="bg-sand/40">
        <div className="container-page max-w-xl py-14 sm:py-20">
          <div className="text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-copper shadow-sm">
              <Search className="size-5" />
            </span>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
              {slug ? "No encontramos esa barbería." : "Buscá tu barbería."}
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              {slug
                ? "Puede que el nombre haya cambiado o que la barbería ya no esté publicada."
                : "Escribí el nombre del local para ver sus servicios y horarios."}
            </p>
          </div>
          <div className="mt-7 rounded-2xl border border-line bg-white p-4">
            <ShopSearch initialQuery={slug} autoFocus />
          </div>
        </div>
      </div>
    );
  }

  const { shop, barbers, hours, services } = data;
  const activeBarbers = barbers.filter((barber) => barber.active);
  const closedWeekdays = [0, 1, 2, 3, 4, 5, 6].filter(
    (weekday) => !hours.some((hour) => hour.weekday === weekday && hour.active),
  );
  const days = nextDays(shop.bookingWindowDays, closedWeekdays, shop.timezone);

  return (
    <div className="bg-sand/40">
      <div className="container-page py-8 sm:py-12">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/#buscar"
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper transition hover:text-copper-dark"
            >
              ← Buscar otra barbería
            </Link>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {shop.name}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-stone-500">{shop.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5 text-copper" />
                {shop.bookingWindowDays} días de agenda
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck className="size-3.5 text-copper" />
                Confirmación inmediata
              </span>
              {shop.address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-copper" />
                  {shop.address}
                </span>
              )}
              {shop.instagram && (
                <a
                  href={`https://instagram.com/${shop.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition hover:text-ink"
                >
                  <AtSign className="size-3.5 text-copper" />
                  {shop.instagram}
                </a>
              )}
              {shop.whatsapp && (
                <a
                  href={whatsappLink(
                    shop.whatsapp,
                    `Hola! Quiero consultar por un turno en ${shop.name}.`,
                    shop.whatsappCountryCode,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition hover:text-ink"
                >
                  <MessageCircle className="size-3.5 text-copper" />
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        <BookingWizard
          shopId={shop.id}
          services={services.map((service) => ({
            id: service.id,
            name: service.name,
            description: service.description,
            durationMin: service.durationMin,
            priceCents: service.priceCents,
          }))}
          barbers={activeBarbers.map((barber) => ({
            id: barber.id,
            name: barber.name,
            color: barber.color,
            bio: barber.bio,
          }))}
          days={days}
          shop={{
            name: shop.name,
            timezone: shop.timezone,
            currency: shop.currency,
            locale: shop.locale,
            whatsapp: shop.whatsapp,
          }}
          initialServiceId={serviceId}
          initialBarberId={barberId}
        />
      </div>
    </div>
  );
}
