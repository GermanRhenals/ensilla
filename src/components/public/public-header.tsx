import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import { Logo } from "@/components/ui/logo";

/**
 * Encabezado del portal. Es genérico a propósito: la barbería se resuelve
 * dentro de cada página, porque el sitio ya no representa a una sola tienda.
 */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="En-silla, inicio">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
          <Link className="transition hover:text-ink" href="/#buscar">
            Buscar barbería
          </Link>
          <Link className="transition hover:text-ink" href="/#como-funciona">
            Cómo funciona
          </Link>
          <Link className="transition hover:text-ink" href="/#para-barberias">
            Para barberías
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost hidden sm:inline-flex">
            Ingresar
          </Link>
          <Link href="/#buscar" className="btn-primary btn-sm sm:px-4 sm:py-2.5">
            <Store className="size-4" />
            Buscar barbería
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
