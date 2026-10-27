"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  Check,
  Clock3,
  HeartHandshake,
  Lightbulb,
  Quote,
  Scissors,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  FALLBACK_SHOP,
  fetchPublicBarbers,
  fetchServices,
  fetchShop,
} from "@/lib/data";
import { formatMoney, initials } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

const steps = [
  {
    title: "Elegí servicio y barbero",
    description:
      "Mirá duración, precio y quién te va a recibir. Si no tenés preferencia, te asignamos al primero disponible.",
  },
  {
    title: "Reservá en segundos",
    description:
      "Ves solo los horarios que están libres de verdad. Confirmás con tu nombre y teléfono, sin llamadas.",
  },
  {
    title: "Llegá y disfrutá",
    description:
      "Tu barbero ya sabe qué te gusta, cómo te cortaste la última vez y qué ideas tienen para la próxima.",
  },
];

const testimonials = [
  {
    name: "Andrés M.",
    text: "Siempre me acuerdo de pedir lo mismo y nunca me acuerdo cómo se llamaba. Ahora está en mi ficha y el corte sale igual de bien.",
    detail: "Cliente desde 2023",
  },
  {
    name: "Camila T.",
    text: "Reservé desde el celular en dos minutos. Llegué y me estaban esperando: cero fila, cero explicaciones repetidas.",
    detail: "Primera visita",
  },
  {
    name: "Julián C.",
    text: "Me propusieron un cambio chico para la próxima y me encantó. Se nota que anotan lo que uno les cuenta.",
    detail: "Cliente frecuente",
  },
];

export default function LandingPage() {
  const { data } = useAsync(
    async () => {
      const [shop, barbers, services] = await Promise.all([
        fetchShop(),
        fetchPublicBarbers(),
        fetchServices(true),
      ]);
      return { shop, barbers, services };
    },
    "landing",
  );
  const shop = data?.shop ?? FALLBACK_SHOP;
  const barbers = data?.barbers ?? [];
  const services = data?.services ?? [];

  return (
    <>
      <section className="relative overflow-hidden bg-ink text-cream">
        <div className="hero-grain absolute inset-0" />
        <div className="absolute -right-24 top-10 hidden size-[34rem] rounded-full border border-white/5 lg:block" />
        <div className="absolute -right-10 top-28 hidden size-[22rem] rounded-full border border-white/5 lg:block" />
        <Scissors
          className="absolute -right-10 bottom-10 hidden size-72 rotate-12 text-white/5 lg:block"
          strokeWidth={0.6}
        />

        <div className="container-page relative grid gap-14 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/70">
              <span className="size-1.5 rounded-full bg-amber" />
              Agenda online · {shop.address?.split(",")[1]?.trim() ?? "Bogotá"}
            </span>

            <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Tu próximo corte,
              <br />
              <span className="text-amber">ya pensado.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-cream/65 sm:text-lg">
              Reservá tu turno, organizá la agenda del día y anticipá lo que
              cada cliente quiere para su próximo corte. Todo en un solo lugar,
              sin esperas ni papelitos perdidos.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/reservar" className="btn-primary px-5 py-3">
                Reservar mi turno
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#servicios"
                className="btn inline-flex border border-white/15 bg-white/5 px-5 py-3 text-cream transition hover:bg-white/10"
              >
                Ver servicios
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-cream/55">
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-amber" />
                Sin llamadas ni esperas
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-amber" />
                Recordamos tu estilo
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-amber" />
                Cancelá cuando quieras
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms]">
            <div className="absolute -inset-4 rounded-[2rem] bg-copper/10 blur-2xl" />
            <div className="ticket-edge relative overflow-hidden rounded-[1.75rem] bg-cream text-ink shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-6 py-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                    Próximo turno
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    Hoy · 18:30
                  </p>
                </div>
                <StatusBadge status="CONFIRMED" />
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">Corte + barba</p>
                    <p className="text-xs text-stone-500">75 minutos · con Bruno</p>
                  </div>
                  <p className="font-display text-xl font-semibold">
                    {formatMoney(5500000, shop.currency, shop.locale)}
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-sand/70 p-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-ink text-sm font-semibold text-cream">
                    AM
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Andrés Mejía</p>
                    <p className="truncate text-xs text-stone-500">
                      Ondulado medio · fade bajo con textura
                    </p>
                  </div>
                  <Sparkles className="size-4 text-copper" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg border border-line px-3 py-2">
                    <p className="text-stone-400">Producto</p>
                    <p className="mt-0.5 font-medium">Pomada mate</p>
                  </div>
                  <div className="rounded-lg border border-line px-3 py-2">
                    <p className="text-stone-400">Idea guardada</p>
                    <p className="mt-0.5 font-medium">Textura despeinada</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-dashed border-line pt-4 text-xs text-stone-500">
                  <span>En-silla Barbershop</span>
                  <span className="font-medium text-sage">Confirmado</span>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-4 hidden w-56 rotate-[-3deg] rounded-xl border border-line bg-white p-3.5 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-sage">
                  <Lightbulb className="size-3.5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  Idea para la próxima
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                Probar flequillo cortina y mantener el fade bajo.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-sand">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-3">
          {[
            {
              icon: CalendarCheck,
              title: "Reservá en 60 segundos",
              text: "Horarios reales, sin idas y vueltas.",
            },
            {
              icon: Clock3,
              title: "Menos espera",
              text: "La agenda del día ordena el flujo desde que abrís.",
            },
            {
              icon: HeartHandshake,
              title: "Cada visita se siente única",
              text: "Preferencias, historial e ideas en la ficha.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-copper shadow-sm">
                <item.icon className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-xs text-stone-500">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="servicios" className="container-page py-16 sm:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              Servicios
            </p>
            <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Cortes que se adaptan a tu ritmo.
            </h2>
          </div>
          <Link href="/reservar" className="btn-secondary self-start">
            Elegir un turno
            <ArrowUpRight className="size-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <Link
              key={service.id}
              href={`/reservar?service=${service.id}`}
              className="group card card-pad flex flex-col transition hover:-translate-y-0.5 hover:border-copper/40 hover:shadow-lg hover:shadow-ink/5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-display text-sm text-stone-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="badge bg-sand text-stone-600 ring-transparent">
                  {service.durationMin} min
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold">
                {service.name}
              </h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-500">
                {service.description ?? "Un servicio pensado para vos."}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="font-display text-lg font-semibold">
                  {formatMoney(service.priceCents, shop.currency, shop.locale)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-copper">
                  Reservar
                  <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
                Cómo funciona
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Simple para el cliente.
                <br />
                Simple para la barbería.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-500">
                El cliente reserva, la barbería organiza. La misma herramienta
                ordena la agenda, la atención y el recuerdo de cada persona.
              </p>
            </div>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-line bg-cream/60 p-4 sm:p-5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-cream">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-500">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="equipo" className="container-page py-16 sm:py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              El equipo
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Manos que ya te conocen.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-stone-500">
            Elegí a tu barbero de confianza o dejate sorprender. Cada uno tiene
            su estilo y su especialidad.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barbers.map((barber) => (
            <div key={barber.id} className="card card-pad">
              <div className="flex items-center gap-3.5">
                <span
                  className="flex size-14 items-center justify-center rounded-full font-display text-lg font-semibold"
                  style={{
                    backgroundColor: `${barber.color}1f`,
                    color: barber.color,
                  }}
                >
                  {initials(barber.name)}
                </span>
                <div>
                  <p className="font-display text-lg font-semibold">
                    {barber.name}
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    {barber.role === "ADMIN" ? "Fundador" : "Barbero"}
                  </p>
                </div>
              </div>
              <p className="mt-4 min-h-12 text-sm leading-relaxed text-stone-500">
                {barber.bio ?? "Cortes con atención al detalle."}
              </p>
              <Link
                href={`/reservar?barber=${barber.id}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-copper"
              >
                Reservar con {barber.name.split(" ")[0]}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="experiencia" className="bg-ink text-cream">
        <div className="container-page grid gap-12 py-16 sm:py-20 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber">
              La experiencia
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Que la segunda visita
              <br />
              se sienta como la primera.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/60">
              Antes de que el cliente se siente, ya sabés cómo le gusta el
              corte, qué producto usa y qué idea le quedó pendiente. La ficha
              guarda la memoria de la barbería.
            </p>

            <div className="mt-8 space-y-3">
              {[
                {
                  icon: Users,
                  title: "Ficha completa",
                  text: "Tipo de cabello, estilo preferido, productos y alergias.",
                },
                {
                  icon: Lightbulb,
                  title: "Ideas para la próxima",
                  text: "Sugerencias según su historial y su estilo.",
                },
                {
                  icon: Star,
                  title: "Historial de visitas",
                  text: "Qué se hizo, quién lo atendió y cuánto sumó.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-amber">
                    <item.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-xs text-cream/50">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 rounded-[2rem] bg-copper/10 blur-2xl" />
            <div className="relative rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-amber/20 text-sm font-semibold text-amber">
                    CT
                  </span>
                  <div>
                    <p className="font-semibold">Camila Torres</p>
                    <p className="text-xs text-cream/50">
                      Cliente desde hace 2 años
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber">
                  Frecuente
                </span>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  ["Cabello", "Rizado"],
                  ["Estilo", "Curly shag"],
                  ["Producto", "Leave-in sin sulfatos"],
                  ["Visitas", "11 en el año"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5"
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] text-cream/40">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-amber/20 bg-amber/[0.07] p-3.5">
                <div className="flex items-center gap-2 text-amber">
                  <Sparkles className="size-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Idea guardada
                  </p>
                </div>
                <p className="mt-1.5 text-sm text-cream/80">
                  Capas medianas que abracen el rizo y secado al aire con
                  leave-in.
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-cream/40">
                <span>Última visita: hace 3 semanas</span>
                <span className="text-cream/70">Bruno · Corte + barba</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              La voz del barrio
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Clientes que vuelven.
            </h2>
          </div>
          <div className="flex items-center gap-1 text-amber">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="size-4 fill-current" />
            ))}
            <span className="ml-2 text-xs font-medium text-stone-500">
              4.9 · +320 visitas
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="card card-pad">
              <Quote className="size-5 text-copper/40" />
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                “{testimonial.text}”
              </p>
              <div className="mt-5 flex items-center gap-2.5 border-t border-line pt-4">
                <span className="flex size-8 items-center justify-center rounded-full bg-sand text-xs font-semibold">
                  {initials(testimonial.name)}
                </span>
                <div>
                  <p className="text-sm font-medium">{testimonial.name}</p>
                  <p className="text-[11px] text-stone-400">
                    {testimonial.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-16 sm:pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-copper px-6 py-12 text-white sm:px-12">
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-24 size-40 rounded-full bg-white/5" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                Tu próximo corte empieza acá
              </p>
              <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Reservá tu turno y dejá que la barbería se acuerde por vos.
              </h2>
            </div>
            <Link
              href="/reservar"
              className="btn inline-flex shrink-0 items-center gap-2 bg-white px-5 py-3 text-ink transition hover:bg-cream"
            >
              Elegir horario
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
