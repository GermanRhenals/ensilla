import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  CalendarCheck,
  Check,
  Clock3,
  Mail,
  Search,
  Scissors,
  Store,
  Users,
} from "lucide-react";
import { ShopSearch } from "@/components/public/shop-search";

const steps = [
  {
    icon: Search,
    title: "Buscá tu barbería",
    description:
      "Escribí el nombre del local que ya conocés. No hace falta recorrer un directorio.",
  },
  {
    icon: Scissors,
    title: "Elegí servicio y barbero",
    description:
      "Mirá duración y precio, y elegí quién te atiende o dejá que te asignemos el primero disponible.",
  },
  {
    icon: CalendarCheck,
    title: "Confirmá el horario",
    description:
      "Ves solo los turnos libres de verdad. Confirmás con tu nombre y teléfono, sin crear una cuenta.",
  },
  {
    icon: Mail,
    title: "Recibí el recordatorio",
    description:
      "Si dejás tu correo al confirmar, podés pedir que te enviemos el recordatorio de la reserva.",
  },
];

export default function HomePage() {
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

        <div className="container-page relative grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream/70">
              <span className="size-1.5 rounded-full bg-amber" />
              Reservas online para barberías de barrio
            </span>

            <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Tu próximo corte,
              <br />
              <span className="text-amber">a un nombre de distancia.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-cream/65 sm:text-lg">
              Buscá tu barbería por nombre, elegí servicio, barbero y horario.
              Ella se encarga del resto: agenda, ficha y recordatorio.
            </p>

            <div id="buscar" className="mt-8 max-w-xl scroll-mt-24">
              <div className="rounded-2xl bg-cream p-3 text-ink shadow-2xl">
                <ShopSearch autoFocus />
              </div>
              <p className="mt-3 text-xs text-cream/45">
                ¿Todavía no sabés el nombre? Pedile el enlace directo a tu
                barbería.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-cream/55">
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-amber" />
                Sin llamadas ni esperas
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-amber" />
                Confirmación inmediata
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="size-4 text-amber" />
                Recordatorio por correo
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms]">
            <div className="absolute -inset-4 rounded-[2rem] bg-copper/10 blur-2xl" />
            <div className="ticket-edge relative overflow-hidden rounded-[1.75rem] bg-cream text-ink shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-6 py-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                    Cómo se ve una reserva
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold">
                    Tu próximo turno
                  </p>
                </div>
                <Store className="size-5 text-copper" />
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="flex items-center gap-3 rounded-xl bg-sand/70 p-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-ink text-cream">
                    <Scissors className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Corte + barba</p>
                    <p className="truncate text-xs text-stone-500">
                      45 minutos · con tu barbero de confianza
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-line px-3.5 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                      Día
                    </p>
                    <p className="mt-1 text-sm font-medium">Viernes 6</p>
                  </div>
                  <div className="rounded-xl border border-line px-3.5 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                      Hora
                    </p>
                    <p className="mt-1 text-sm font-medium">17:30</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-dashed border-line pt-4 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5 text-copper" />
                    Confirmación al instante
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sage">
                    <Check className="size-3.5" />
                    Reservado
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-4 hidden w-56 rotate-[-3deg] rounded-xl border border-line bg-white p-3.5 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-sage">
                  <Mail className="size-3.5" />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  Recordatorio
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                Agregá tu correo después de reservar y te avisamos antes del
                turno.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-sand">
        <div className="container-page grid gap-6 py-8 sm:grid-cols-3">
          {[
            {
              icon: Search,
              title: "Buscás por nombre",
              text: "Solo aparece la barbería que buscás, no un listado infinito.",
            },
            {
              icon: Users,
              title: "Elegís a tu barbero",
              text: "Ves quién está disponible y a qué hora.",
            },
            {
              icon: CalendarCheck,
              title: "Confirmás en segundos",
              text: "Nombre y teléfono, nada más. El correo es opcional.",
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

      <section id="como-funciona" className="container-page scroll-mt-24 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              Cómo funciona
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              De la búsqueda
              <br />
              a la silla.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-500">
              El flujo es corto a propósito: buscás, elegís y confirmás. La
              barbería recibe el turno en su agenda al instante.
            </p>
            <Link href="/#buscar" className="btn-primary mt-6">
              Buscar mi barbería
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-cream">
                  {index + 1}
                </span>
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <step.icon className="size-4 text-copper" />
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-500">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="para-barberias"
        className="scroll-mt-24 border-y border-line bg-white"
      >
        <div className="container-page grid gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
              Para barberías
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Cada barbería con su propia agenda.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-500">
              En-silla separa por completo los datos de cada barbería: equipo,
              servicios, clientes, turnos y recordatorios. Un cliente de una
              barbería nunca ve la información de otra.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-stone-600">
              <span className="rounded-full border border-line px-3 py-1">
                Agenda diaria
              </span>
              <span className="rounded-full border border-line px-3 py-1">
                Fichas de cliente
              </span>
              <span className="rounded-full border border-line px-3 py-1">
                Historial e ideas
              </span>
              <span className="rounded-full border border-line px-3 py-1">
                Recordatorios por correo
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-cream/60 p-5 sm:p-6">
            <p className="flex items-center gap-2 font-semibold">
              <Store className="size-4 text-copper" />
              Acceso del equipo
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Si ya tenés una cuenta, ingresá al panel para administrar tu
              barbería. Las cuentas nuevas las crea un administrador; no hay
              registro público.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link href="/login" className="btn-primary flex-1">
                Ingresar al panel
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/#buscar" className="btn-secondary flex-1">
                <AtSign className="size-4" />
                Buscar una barbería
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-copper px-6 py-12 text-white sm:px-12">
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-24 size-40 rounded-full bg-white/5" />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                Tu próximo corte empieza acá
              </p>
              <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Buscá tu barbería y reservá en el mismo lugar.
              </h2>
            </div>
            <Link
              href="/#buscar"
              className="btn inline-flex shrink-0 items-center gap-2 bg-white px-5 py-3 text-ink transition hover:bg-cream"
            >
              Buscar barbería
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
