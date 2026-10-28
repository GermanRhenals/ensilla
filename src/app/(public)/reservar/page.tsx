"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, Clock3, Loader2, MapPin } from "lucide-react";
import { BookingWizard } from "@/components/booking/booking-wizard";
import {
  fetchBusinessHours,
  fetchPublicBarbers,
  fetchServices,
  fetchShop,
} from "@/lib/data";
import { nextDays } from "@/lib/datetime";
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
  const { data, error: loadError, loading } = useAsync(async () => {
    const [shop, barbers, hours, services] = await Promise.all([
      fetchShop(),
      fetchPublicBarbers(),
      fetchBusinessHours(),
      fetchServices(true),
    ]);
    return { shop, barbers, hours, services };
  }, "booking");

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-stone-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="font-display text-3xl font-semibold">
          No pudimos cargar la agenda.
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {loadError ?? "Intentá de nuevo en unos minutos."}
        </p>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              Reserva online
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Buscá tu lugar en la silla.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-stone-500">
              Elegí servicio, barbero y horario. Te esperamos con todo listo,
              sin vueltas y sin llamadas.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-500">
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
          </div>
        </div>

        <BookingWizard
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
          initialServiceId={params.get("service") ?? undefined}
          initialBarberId={params.get("barber") ?? undefined}
        />
      </div>
    </div>
  );
}
