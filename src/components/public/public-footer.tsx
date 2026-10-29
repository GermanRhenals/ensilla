import Link from "next/link";
import { CalendarCheck, Scissors, Search, Store } from "lucide-react";
import { Logo } from "@/components/ui/logo";

/**
 * Pie del portal. No muestra horarios ni contacto de una barbería concreta:
 * esos datos viven en la página de cada barbería y en la confirmación.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-ink-soft bg-ink text-cream">
      <div className="container-page grid gap-10 py-14 md:grid-cols-3">
        <div className="md:col-span-2">
          <Logo className="text-cream" />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/60">
            Un solo lugar para encontrar tu barbería y reservar tu próximo
            corte. Cada barbería administra su agenda, su equipo y sus
            servicios.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-cream/70">
            <span className="rounded-full border border-white/15 px-3 py-1">
              Búsqueda por nombre
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Confirmación inmediata
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Recordatorio por correo
            </span>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40">
            Accesos
          </p>
          <ul className="mt-4 space-y-3 text-sm text-cream/70">
            <li>
              <Link
                href="/#buscar"
                className="inline-flex items-center gap-2 transition hover:text-cream"
              >
                <Search className="size-4 text-copper" />
                Buscar una barbería
              </Link>
            </li>
            <li>
              <Link
                href="/#como-funciona"
                className="inline-flex items-center gap-2 transition hover:text-cream"
              >
                <CalendarCheck className="size-4 text-copper" />
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 transition hover:text-cream"
              >
                <Store className="size-4 text-copper" />
                Acceso del equipo
              </Link>
            </li>
            <li>
              <Link
                href="/registro"
                className="inline-flex items-center gap-2 transition hover:text-cream"
              >
                <Scissors className="size-4 text-copper" />
                Sumá tu barbería
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-start justify-between gap-3 py-5 text-xs text-cream/40 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} En-silla. Todos los derechos reservados.</p>
          <p>Los horarios y precios los define cada barbería.</p>
        </div>
      </div>
    </footer>
  );
}
