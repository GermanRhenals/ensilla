"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, AtSign, Loader2, MapPin, Search } from "lucide-react";
import { searchShops } from "@/lib/data";
import type { ShopSummary } from "@/lib/types";

/**
 * Buscador de barberías por nombre o slug.
 *
 * La búsqueda se resuelve en Postgres con `search_shops`, que exige al menos
 * dos caracteres y solo devuelve barberías activas. El componente se reutiliza
 * en la portada y en los estados vacíos de la reserva.
 */
export function ShopSearch({
  initialQuery = "",
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  // El resultado guarda el término que lo produjo. Así la interfaz sabe si
  // sigue vigente cuando el usuario vuelve a escribir, sin necesidad de
  // reiniciar el estado desde el efecto.
  const [resolved, setResolved] = useState<{
    term: string;
    shops: ShopSummary[];
    error: string | null;
  } | null>(null);

  const term = query.trim();
  const current = resolved?.term === term ? resolved : null;
  const loading = term.length >= 2 && current === null;
  const results = term.length >= 2 ? (current?.shops ?? null) : null;
  const error = current?.error ?? null;

  useEffect(() => {
    if (term.length < 2) return;

    let cancelled = false;

    // El retardo evita una consulta por cada tecla. Todo `setState` ocurre
    // dentro del callback, nunca de forma sincrónica en el efecto.
    const timer = window.setTimeout(() => {
      searchShops(term)
        .then((shops) => {
          if (!cancelled) setResolved({ term, shops, error: null });
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            setResolved({
              term,
              shops: [],
              error:
                searchError instanceof Error
                  ? searchError.message
                  : "No pudimos buscar barberías.",
            });
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  return (
    <div className="w-full">
      <form
        onSubmit={(event) => event.preventDefault()}
        className="relative"
        role="search"
      >
        <label className="sr-only" htmlFor="shop-search">
          Nombre de la barbería
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <input
          id="shop-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          className="input h-12 pl-11 pr-28 text-base"
          placeholder="Escribí el nombre de tu barbería"
        />
        <span className="absolute right-4 top-1/2 hidden -translate-y-1/2 text-xs text-stone-400 sm:block">
          {loading ? "Buscando..." : term.length >= 2 ? "Resultados" : "Mín. 2 letras"}
        </span>
      </form>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}

      {term.length > 0 && term.length < 2 && (
        <p className="mt-3 text-sm text-stone-500">
          Escribí al menos dos letras para buscar.
        </p>
      )}

      {loading && results === null && (
        <p className="mt-5 flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="size-4 animate-spin" />
          Buscando barberías...
        </p>
      )}

      {results !== null && !loading && (
        <div className="mt-5">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-sand/40 p-6 text-center">
              <p className="text-sm font-medium">
                No encontramos una barbería con ese nombre.
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Revisá cómo se escribe o pedile el enlace directo a la
                barbería.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {results.length === 1
                  ? "1 barbería encontrada"
                  : `${results.length} barberías encontradas`}
              </p>
              <ul className="space-y-3">
                {results.map((shop) => (
                  <li key={shop.id}>
                    <Link
                      href={`/reservar?barberia=${encodeURIComponent(shop.slug)}`}
                      className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 transition hover:border-copper/50 hover:bg-copper-soft/20"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-cream">
                        {shop.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{shop.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-stone-500">
                          {shop.tagline}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-400">
                          {shop.address && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {shop.address}
                            </span>
                          )}
                          {shop.instagram && (
                            <span className="inline-flex items-center gap-1">
                              <AtSign className="size-3" />
                              {shop.instagram}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-copper">
                        Reservar
                        <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
