import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_WHATSAPP_COUNTRY_CODE,
} from "./constants";

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

export function formatNumber(value: number, locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale).format(value);
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
  let digits = phone.replace(/\D/g, "");
  if (
    countryCode === "57" &&
    digits.startsWith("57") &&
    digits.length === 12
  ) {
    digits = digits.slice(2);
  }
  if (countryCode === "57" && digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (countryCode === "54" && digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (countryCode === "54" && digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export function whatsappNumber(
  phone: string,
  countryCode = DEFAULT_WHATSAPP_COUNTRY_CODE,
) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (countryCode === "54") {
    if (digits.startsWith("549")) return digits;
    if (digits.startsWith("54")) return digits;
    if (digits.startsWith("0")) return `549${digits.slice(1)}`;
    if (digits.length === 10) return `549${digits}`;
    if (digits.startsWith("9") && digits.length === 11) return `54${digits}`;
    return `54${digits}`;
  }

  if (digits.startsWith(countryCode) && digits.length > countryCode.length) {
    return digits;
  }
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return `${countryCode}${local}`;
}

export function whatsappLink(
  phone: string,
  message: string,
  countryCode = DEFAULT_WHATSAPP_COUNTRY_CODE,
) {
  return `https://wa.me/${whatsappNumber(phone, countryCode)}?text=${encodeURIComponent(message)}`;
}

export function percent(value: number) {
  return `${Math.round(value)}%`;
}

export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
