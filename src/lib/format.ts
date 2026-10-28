import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_WHATSAPP_COUNTRY_CODE,
} from "./constants";
import { normalizePhone } from "./phone";

export function formatMoney(
  cents: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE,
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${new Intl.NumberFormat(DEFAULT_LOCALE, {
      maximumFractionDigits: 0,
    }).format(cents / 100)}`;
  }
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function formatPhone(
  phone: string,
  countryCode = DEFAULT_WHATSAPP_COUNTRY_CODE,
) {
  const digits = normalizePhone(phone, countryCode);
  if (!digits) return phone;
  return `+${countryCode.replace(/\D/g, "")} ${digits}`;
}

/**
 * Número listo para `wa.me`: código de país + número local normalizado.
 * No se agregan prefijos específicos de un país para que el producto pueda
 * operar en cualquier mercado sin tocar código.
 */
export function whatsappNumber(
  phone: string,
  countryCode = DEFAULT_WHATSAPP_COUNTRY_CODE,
) {
  const digits = normalizePhone(phone, countryCode);
  if (!digits) return "";
  return `${countryCode.replace(/\D/g, "")}${digits}`;
}

export function whatsappLink(
  phone: string,
  message: string,
  countryCode = DEFAULT_WHATSAPP_COUNTRY_CODE,
) {
  return `https://wa.me/${whatsappNumber(phone, countryCode)}?text=${encodeURIComponent(message)}`;
}
