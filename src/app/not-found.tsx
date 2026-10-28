/**
 * Página 404.
 *
 * RESPONSABILIDAD
 * Responder con un mensaje claro cuando la ruta no existe. En el export
 * estático este componente genera `out/404.html`, que GitHub Pages sirve para
 * cualquier URL desconocida.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-5">
      <div className="card card-pad w-full max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
          Error 404
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          El enlace puede estar incompleto o el contenido ya no existe.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="btn-primary flex-1">
            Ir al inicio
          </Link>
          <Link href="/reservar" className="btn-secondary flex-1">
            Reservar un turno
          </Link>
        </div>
      </div>
    </div>
  );
}
