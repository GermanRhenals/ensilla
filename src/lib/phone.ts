/**
 * Normalización de teléfonos del lado del cliente.
 *
 * RESPONSABILIDAD
 * Dejar un teléfono en dígitos, sin prefijo internacional ni 0 de marcado local.
 *
 * IMPORTANTE
 * Debe producir el mismo resultado que `public.normalize_phone` en Postgres
 * (supabase/migrations/20261028000000_security_hardening.sql): si cambia una,
 * hay que cambiar la otra. De lo contrario la búsqueda por teléfono deja de
 * encontrar clientes creados desde el otro lado.
 */

import { DEFAULT_WHATSAPP_COUNTRY_CODE } from "./constants";

export function normalizePhone(
  input: string,
  countryCode = DEFAULT_WHATSAPP_COUNTRY_CODE,
) {
  const country = countryCode.replace(/\D/g, "");

  let digits = input.replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");

  if (
    country.length > 0 &&
    digits.startsWith(country) &&
    digits.length - country.length >= 8
  ) {
    digits = digits.slice(country.length);
  }

  return digits.replace(/^0/, "");
}
