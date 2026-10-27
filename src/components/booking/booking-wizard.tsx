"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Scissors,
  Sparkles,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { getAvailability } from "@/lib/availability";
import { createPublicBooking } from "@/lib/booking";
import { formatMoney, initials } from "@/lib/format";
import type { DayOption } from "@/lib/datetime";

type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
};

type BarberOption = {
  id: string;
  name: string;
  color: string;
  bio: string | null;
};

type ShopInfo = {
  name: string;
  timezone: string;
  currency: string;
  locale: string;
  whatsapp: string | null;
};

type Slot = {
  start: string;
  end: string;
  barberId: string;
  barberName: string;
  barberColor: string;
};

const steps = [
  { id: 1, label: "Servicio" },
  { id: 2, label: "Barbero" },
  { id: 3, label: "Horario" },
  { id: 4, label: "Tus datos" },
];

export function BookingWizard({
  services,
  barbers,
  days,
  shop,
  initialServiceId,
  initialBarberId,
}: {
  services: ServiceOption[];
  barbers: BarberOption[];
  days: DayOption[];
  shop: ShopInfo;
  initialServiceId?: string;
  initialBarberId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(
    services.some((service) => service.id === initialServiceId)
      ? (initialServiceId as string)
      : "",
  );
  const [barberId, setBarberId] = useState(
    barbers.some((barber) => barber.id === initialBarberId)
      ? (initialBarberId as string)
      : "any",
  );
  const [dayKey, setDayKey] = useState(
    days.find((day) => !day.isClosed)?.key ?? days[0]?.key ?? "",
  );
  const [slotResult, setSlotResult] = useState<{
    key: string;
    slots: Slot[];
    error: string | null;
  } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    hairType: "",
    preferredStyle: "",
    notes: "",
  });

  const service = services.find((item) => item.id === serviceId);
  const barber =
    barberId === "any"
      ? null
      : barbers.find((item) => item.id === barberId) ?? null;
  const day = days.find((item) => item.key === dayKey);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(shop.locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: shop.timezone,
      }),
    [shop.locale, shop.timezone],
  );

  const slotRequestKey = `${serviceId}|${barberId}|${dayKey}`;

  useEffect(() => {
    if (step !== 3 || !serviceId || !dayKey) return;

    const key = `${serviceId}|${barberId}|${dayKey}`;
    let cancelled = false;

    getAvailability({
      dayKey,
      serviceId,
      barberId: barberId === "any" ? undefined : barberId,
    })
      .then((result) => {
        if (!cancelled) {
          setSlotResult({ key, slots: result, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSlotResult({
            key,
            slots: [],
            error: "No pudimos cargar los horarios. Probá de nuevo.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [step, serviceId, dayKey, barberId]);

  const slots =
    slotResult?.key === slotRequestKey ? slotResult.slots : [];
  const slotError =
    slotResult?.key === slotRequestKey ? slotResult.error : null;
  const loadingSlots =
    step === 3 &&
    Boolean(serviceId && dayKey) &&
    slotResult?.key !== slotRequestKey;

  const hourOf = (slot: Slot) =>
    Number(timeFormatter.format(new Date(slot.start)).slice(0, 2));
  const morning = slots.filter((slot) => hourOf(slot) < 13);
  const afternoon = slots.filter((slot) => hourOf(slot) >= 13);

  function chooseService(id: string) {
    setServiceId(id);
    setSelectedSlot(null);
    setStep(2);
  }

  function chooseBarber(id: string) {
    setBarberId(id);
    setSelectedSlot(null);
    setStep(3);
  }

  async function submit() {
    if (!selectedSlot || !service) return;
    setFormError(null);
    setPending(true);

    const result = await createPublicBooking({
      serviceId,
      barberId: selectedSlot.barberId,
      start: selectedSlot.start,
      name: form.name,
      phone: form.phone,
      email: form.email,
      hairType: form.hairType,
      preferredStyle: form.preferredStyle,
      notes: form.notes,
    });

    if (result.ok) {
      router.push(`/reservar/confirmacion?id=${result.appointmentId}`);
    } else {
      setFormError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div>
        <ol className="mb-6 flex items-center gap-2 overflow-x-auto pb-1 scroll-thin">
          {steps.map((item, index) => {
            const active = step === item.id;
            const done = step > item.id;
            return (
              <li key={item.id} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (item.id < step) setStep(item.id);
                  }}
                  disabled={item.id >= step}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-ink text-cream"
                      : done
                        ? "bg-copper-soft text-copper-dark"
                        : "text-stone-400"
                  }`}
                >
                  <span
                    className={`flex size-5 items-center justify-center rounded-full text-[10px] ${
                      active
                        ? "bg-white/15"
                        : done
                          ? "bg-copper text-white"
                          : "bg-sand text-stone-400"
                    }`}
                  >
                    {done ? <Check className="size-3" /> : item.id}
                  </span>
                  {item.label}
                </button>
                {index < steps.length - 1 && (
                  <span className="h-px w-full min-w-3 bg-line" />
                )}
              </li>
            );
          })}
        </ol>

        <div className="card p-5 sm:p-7">
          {step === 1 && (
            <div className="animate-fade">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    ¿Qué te vas a hacer?
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Elegí el servicio y te mostramos los horarios reales.
                  </p>
                </div>
                <Scissors className="mt-1 size-6 text-copper" />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseService(item.id)}
                    className={`group rounded-2xl border p-4 text-left transition hover:border-copper/60 hover:bg-copper-soft/30 ${
                      serviceId === item.id
                        ? "border-copper bg-copper-soft/40"
                        : "border-line bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{item.name}</p>
                      <span className="flex items-center gap-1 text-[11px] text-stone-500">
                        <Clock className="size-3.5" />
                        {item.durationMin} min
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-500">
                      {item.description ?? "Un servicio pensado para vos."}
                    </p>
                    <p className="mt-3 font-display text-lg font-semibold">
                      {formatMoney(item.priceCents, shop.currency, shop.locale)}
                    </p>
                  </button>
                ))}
              </div>

              {services.length === 0 && (
                <p className="mt-6 rounded-xl bg-sand p-4 text-sm text-stone-600">
                  No hay servicios disponibles por el momento.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    ¿Con quién te atendés?
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Podés elegir a tu barbero o dejar que te asignemos el
                    primero disponible.
                  </p>
                </div>
                <UserRound className="mt-1 size-6 text-copper" />
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => chooseBarber("any")}
                  className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition hover:border-copper/60 ${
                    barberId === "any"
                      ? "border-copper bg-copper-soft/40"
                      : "border-line bg-white"
                  }`}
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-ink text-cream">
                    <Sparkles className="size-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">
                      Cualquier barbero disponible
                    </span>
                    <span className="block text-xs text-stone-500">
                      La opción más rápida. Te asignamos al primero libre.
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-stone-400" />
                </button>

                {barbers.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => chooseBarber(item.id)}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition hover:border-copper/60 ${
                      barberId === item.id
                        ? "border-copper bg-copper-soft/40"
                        : "border-line bg-white"
                    }`}
                  >
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold"
                      style={{
                        backgroundColor: `${item.color}1f`,
                        color: item.color,
                      }}
                    >
                      {initials(item.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{item.name}</span>
                      <span className="block truncate text-xs text-stone-500">
                        {item.bio ?? "Cortes con atención al detalle."}
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-stone-400" />
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-ghost"
                >
                  <ArrowLeft className="size-4" />
                  Cambiar servicio
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    Elegí día y horario
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Solo mostramos los turnos que están libres.
                  </p>
                </div>
                <CalendarDays className="mt-1 size-6 text-copper" />
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto pb-2 scroll-thin">
                {days.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={item.isClosed}
                    onClick={() => {
                      setDayKey(item.key);
                      setSelectedSlot(null);
                    }}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-xl border px-2 py-2.5 text-center transition ${
                      item.key === dayKey
                        ? "border-ink bg-ink text-cream"
                        : item.isClosed
                          ? "cursor-not-allowed border-line bg-sand/50 text-stone-300"
                          : "border-line bg-white text-stone-600 hover:border-copper/50"
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                      {item.weekdayShort}
                    </span>
                    <span className="mt-1 font-display text-lg font-semibold leading-none">
                      {item.dayNumber}
                    </span>
                    <span className="mt-1 text-[10px] opacity-60">
                      {item.isClosed ? "cerr." : item.monthShort}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-4 text-sm font-medium text-stone-600">
                {day?.label}
                {barber ? ` · con ${barber.name}` : ""}
              </p>

              {loadingSlots ? (
                <div className="mt-8 flex items-center justify-center gap-2 py-10 text-sm text-stone-500">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando horarios...
                </div>
              ) : slotError ? (
                <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
                  {slotError}
                </p>
              ) : slots.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-line bg-sand/40 p-6 text-center">
                  <p className="text-sm font-medium">
                    No quedan horarios para este día.
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Probá con otra fecha o cambiá de barbero.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  {[
                    { title: "Mañana", items: morning },
                    { title: "Tarde", items: afternoon },
                  ]
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                      <div key={group.title}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                          {group.title}
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {group.items.map((slot) => {
                            const active = selectedSlot?.start === slot.start;
                            return (
                              <button
                                key={slot.start}
                                type="button"
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setStep(4);
                                }}
                                className={`rounded-xl border px-2 py-2.5 text-center transition ${
                                  active
                                    ? "border-copper bg-copper text-white"
                                    : "border-line bg-white hover:border-copper hover:bg-copper-soft/30"
                                }`}
                              >
                                <span className="block text-sm font-semibold tabular-nums">
                                  {timeFormatter.format(new Date(slot.start))}
                                </span>
                                <span
                                  className={`mt-0.5 block truncate text-[10px] ${active ? "text-white/70" : "text-stone-400"}`}
                                >
                                  {barberId === "any"
                                    ? slot.barberName.split(" ")[0]
                                    : "disponible"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-ghost"
                >
                  <ArrowLeft className="size-4" />
                  Cambiar barbero
                </button>
              </div>
            </div>
          )}

          {step === 4 && selectedSlot && service && (
            <div className="animate-fade">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    Tus datos
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Con esto te esperamos. No hace falta crear una cuenta.
                  </p>
                </div>
                <Check className="mt-1 size-6 text-sage" />
              </div>

              <div className="mt-5 rounded-2xl border border-line bg-sand/40 p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold">{service.name}</span>
                  <span className="text-stone-500">
                    {day?.label} ·{" "}
                    {timeFormatter.format(new Date(selectedSlot.start))}
                  </span>
                  <span className="text-stone-500">
                    con {selectedSlot.barberName}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {service.durationMin} minutos ·{" "}
                  {formatMoney(service.priceCents, shop.currency, shop.locale)}
                </p>
              </div>

              {formError && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {formError}
                </div>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
                className="mt-5 space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="booking-name">
                      Nombre y apellido *
                    </label>
                    <input
                      id="booking-name"
                      required
                      minLength={2}
                      maxLength={80}
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      className="input"
                      placeholder="Andrés Mejía"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="booking-phone">
                      Teléfono *
                    </label>
                    <input
                      id="booking-phone"
                      required
                      minLength={6}
                      maxLength={30}
                      value={form.phone}
                      onChange={(event) =>
                        setForm({ ...form, phone: event.target.value })
                      }
                      className="input"
                      placeholder="300 555 0101"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="booking-email">
                    Email (opcional)
                  </label>
                  <input
                    id="booking-email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    className="input"
                    placeholder="vos@email.com"
                    autoComplete="email"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="booking-hair">
                      Tu cabello (opcional)
                    </label>
                    <input
                      id="booking-hair"
                      value={form.hairType}
                      onChange={(event) =>
                        setForm({ ...form, hairType: event.target.value })
                      }
                      className="input"
                      placeholder="Ondulado, liso, crespo..."
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="booking-style">
                      Estilo que te gusta (opcional)
                    </label>
                    <input
                      id="booking-style"
                      value={form.preferredStyle}
                      onChange={(event) =>
                        setForm({ ...form, preferredStyle: event.target.value })
                      }
                      className="input"
                      placeholder="Fade bajo con textura"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="booking-notes">
                    Algo que debamos saber (opcional)
                  </label>
                  <textarea
                    id="booking-notes"
                    rows={3}
                    maxLength={500}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                    className="textarea"
                    placeholder="Alergias, referencias, si venís con poco tiempo..."
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-ghost"
                    disabled={pending}
                  >
                    <ArrowLeft className="size-4" />
                    Cambiar horario
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-5"
                    disabled={pending}
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        Confirmar reserva
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-2xl border border-line bg-ink text-cream">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/40">
              Tu reserva
            </p>
            <p className="mt-1 font-display text-lg font-semibold">
              {shop.name}
            </p>
          </div>
          <div className="space-y-3.5 px-5 py-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="text-cream/40">Servicio</span>
              <span className="text-right font-medium">
                {service?.name ?? "Elegí un servicio"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-cream/40">Barbero</span>
              <span className="text-right font-medium">
                {selectedSlot?.barberName ??
                  barber?.name ??
                  (barberId === "any" ? "Cualquiera disponible" : "Elegí uno")}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-cream/40">Fecha</span>
              <span className="text-right font-medium">
                {selectedSlot
                  ? `${day?.label} · ${timeFormatter.format(new Date(selectedSlot.start))}`
                  : day?.label ?? "Elegí un día"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-cream/40">Duración</span>
              <span className="text-right font-medium">
                {service ? `${service.durationMin} min` : "—"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-white/10 pt-3.5">
              <span className="text-cream/40">Total</span>
              <span className="font-display text-2xl font-semibold">
                {service
                  ? formatMoney(service.priceCents, shop.currency, shop.locale)
                  : "—"}
              </span>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/[0.03] px-5 py-3.5 text-[11px] leading-relaxed text-cream/45">
            Se abona en el local. Si necesitás cancelar, avisanos por WhatsApp
            con anticipación.
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-stone-500">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Sparkles className="size-4 text-copper" />
            Cada visita cuenta
          </p>
          <p className="mt-1.5">
            Al reservar, tu barbero verá si es tu primera vez y podrá guardar
            tus preferencias para la próxima.
          </p>
        </div>
      </aside>
    </div>
  );
}
