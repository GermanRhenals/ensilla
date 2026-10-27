import Link from "next/link";
import { AtSign, Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { minutesToTime } from "@/lib/datetime";
import type { Shop } from "@/lib/shop";

type Hour = {
  weekday: number;
  openMinute: number;
  closeMinute: number;
  active: boolean;
};

export function PublicFooter({
  shop,
  hours,
}: {
  shop: Shop;
  hours: Hour[];
}) {
  const activeHours = hours.filter((hour) => hour.active);

  return (
    <footer id="horarios" className="border-t border-ink-soft bg-ink text-cream">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo className="text-cream" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/60">
            {shop.description ??
              "Una barbería de barrio que se toma el tiempo de conocerte."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-cream/70">
            <span className="rounded-full border border-white/15 px-3 py-1">
              Turnos online
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Fichas de cliente
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1">
              Sin esperas
            </span>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40">
            Contacto
          </p>
          <ul className="mt-4 space-y-3 text-sm text-cream/70">
            {shop.address && (
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-copper" />
                <span>{shop.address}</span>
              </li>
            )}
            {shop.phone && (
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-copper" />
                <a
                  href={`tel:${shop.phone.replace(/\s/g, "")}`}
                  className="transition hover:text-cream"
                >
                  {shop.phone}
                </a>
              </li>
            )}
            {shop.email && (
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-copper" />
                <a
                  href={`mailto:${shop.email}`}
                  className="transition hover:text-cream"
                >
                  {shop.email}
                </a>
              </li>
            )}
            {shop.instagram && (
              <li className="flex items-start gap-2.5">
                <AtSign className="mt-0.5 size-4 shrink-0 text-copper" />
                <a
                  href={`https://instagram.com/${shop.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-cream"
                >
                  @{shop.instagram}
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40">
            Horarios
          </p>
          <ul className="mt-4 space-y-2 text-sm text-cream/70">
            {activeHours.length === 0 && (
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-copper" />
                Horarios a confirmar
              </li>
            )}
            {activeHours.map((hour) => (
              <li key={hour.weekday} className="flex justify-between gap-4">
                <span>{WEEKDAY_LABELS[hour.weekday]}</span>
                <span className="tabular-nums text-cream">
                  {minutesToTime(hour.openMinute)} –{" "}
                  {minutesToTime(hour.closeMinute)}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/reservar" className="btn-primary btn-sm mt-5">
            Reservar turno
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-start justify-between gap-3 py-5 text-xs text-cream/40 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {shop.name}. Todos los derechos
            reservados.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/reservar" className="transition hover:text-cream/80">
              Reservar
            </Link>
            <Link href="/login" className="transition hover:text-cream/80">
              Acceso equipo
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
