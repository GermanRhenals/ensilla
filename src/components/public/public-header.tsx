import Link from "next/link";
import { ArrowUpRight, AtSign } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import type { Shop } from "@/lib/types";

export function PublicHeader({ shop }: { shop: Shop }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="En-silla, inicio">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-stone-600 md:flex">
          <Link className="transition hover:text-ink" href="/#servicios">
            Servicios
          </Link>
          <Link className="transition hover:text-ink" href="/#equipo">
            Equipo
          </Link>
          <Link className="transition hover:text-ink" href="/#experiencia">
            Experiencia
          </Link>
          <Link className="transition hover:text-ink" href="/#horarios">
            Horarios
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {shop.instagram && (
            <a
              href={`https://instagram.com/${shop.instagram}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hidden size-9 items-center justify-center rounded-full border border-line text-stone-500 transition hover:bg-sand hover:text-ink sm:flex"
            >
              <AtSign className="size-4" />
            </a>
          )}
          <Link href="/login" className="btn-ghost hidden sm:inline-flex">
            Ingresar
          </Link>
          <Link href="/reservar" className="btn-primary btn-sm sm:px-4 sm:py-2.5">
            Reservar turno
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
