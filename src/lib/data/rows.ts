/**
 * Utilidades compartidas de la capa de datos.
 *
 * RESPONSABILIDAD
 * Normalizar las respuestas de Supabase (que llegan como `unknown`) y ofrecer
 * lectura paginada. Ninguna pantalla debe tocar `supabase` directamente.
 *
 * CONTRATO
 * - `fail` convierte un error de PostgREST en una excepción con mensaje legible.
 * - `selectAllPages` recorre resultados de más de mil filas respetando el tope
 *   por defecto de la API de Supabase.
 */

import type { PostgrestError } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;

/** Tope de filas por respuesta de PostgREST. */
export const PAGE_SIZE = 1000;

/**
 * Columnas y relaciones que necesita todo turno para mostrarse.
 * El alias `barber` usa el nombre real de la clave foránea para que PostgREST
 * no tenga que adivinar la relación.
 */
export const APPOINTMENT_SELECT = `
  *,
  client:clients(*),
  service:services(*),
  barber:profiles!appointments_barber_id_fkey(*)
`;

export function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function nullableText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  return Number(value ?? 0);
}

export function boolValue(value: unknown) {
  return value === true;
}

/** Corta la ejecución con el mensaje de Supabase o uno genérico. */
export function fail(error: { message: string } | null): never {
  throw new Error(error?.message ?? "No se pudo completar la operación.");
}

type PageResponse<T> = PromiseLike<{
  data: T[] | null;
  error: PostgrestError | null;
}>;

/**
 * Recorre todas las páginas de una consulta.
 *
 * IMPORTANTE: el constructor debe aplicar un `order` estable; si no, Postgres
 * puede devolver las filas en orden distinto entre páginas y duplicar u omitir
 * registros.
 */
export async function selectAllPages<T>(
  build: (from: number, to: number) => PageResponse<T>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await build(from, to);
    if (error) fail(error);

    const page = data ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}
