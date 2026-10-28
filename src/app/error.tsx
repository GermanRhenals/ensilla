"use client";

/**
 * Frontera de error global.
 *
 * RESPONSABILIDAD
 * Evitar la pantalla en blanco cuando una vista falla en tiempo de ejecución.
 * Next.js captura el error, renderiza este componente y ofrece reintentar sin
 * recargar toda la aplicación.
 *
 * IMPORTANTE
 * No se muestran detalles técnicos del error: pueden revelar rutas internas o
 * datos de la consulta. El detalle queda en la consola del navegador.
 */

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-5">
      <div className="card card-pad w-full max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">
          Algo salió mal
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          No pudimos completar la operación. Podés reintentar o volver al
          inicio. Si el problema continúa, avisá a quien administra el sistema.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={reset} className="btn-primary flex-1">
            <RotateCcw className="size-4" />
            Reintentar
          </button>
          <Link href="/" className="btn-secondary flex-1">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
