/**
 * Configuración de la barbería y horario de atención.
 *
 * RESPONSABILIDAD
 * Leer y escribir los ajustes globales (`shop_setting`) y el horario semanal
 * (`business_hours`), únicos registros que definen zona horaria, moneda, país
 * de WhatsApp y reglas de agenda.
 *
 * SEGURIDAD
 * La escritura está protegida por RLS: solo un administrador puede guardar.
 */

import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  DEFAULT_WHATSAPP_COUNTRY_CODE,
} from "../constants";
import type { BusinessHour, Shop } from "../types";
import { supabase } from "../supabase";
import {
  boolValue,
  fail,
  nullableText,
  numberValue,
  text,
  type Row,
} from "./rows";

/**
 * Valores usados mientras cargan los ajustes o si la fila todavía no existe.
 * Deben coincidir con los defaults de la migración inicial.
 */
export const FALLBACK_SHOP: Shop = {
  name: "En-silla Barbershop",
  tagline: "Cortes con memoria",
  description: null,
  address: null,
  phone: null,
  whatsapp: null,
  email: null,
  instagram: null,
  currency: DEFAULT_CURRENCY,
  timezone: DEFAULT_TIMEZONE,
  locale: DEFAULT_LOCALE,
  whatsappCountryCode: DEFAULT_WHATSAPP_COUNTRY_CODE,
  slotStepMin: 15,
  bufferMin: 10,
  leadTimeMin: 60,
  bookingWindowDays: 21,
};

export async function fetchShop(): Promise<Shop> {
  const { data, error } = await supabase
    .from("shop_setting")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) fail(error);
  if (!data) return FALLBACK_SHOP;

  return {
    name: text(data.name) || FALLBACK_SHOP.name,
    tagline: text(data.tagline) || FALLBACK_SHOP.tagline,
    description: nullableText(data.description),
    address: nullableText(data.address),
    phone: nullableText(data.phone),
    whatsapp: nullableText(data.whatsapp),
    email: nullableText(data.email),
    instagram: nullableText(data.instagram),
    currency: text(data.currency) || DEFAULT_CURRENCY,
    timezone: text(data.timezone) || DEFAULT_TIMEZONE,
    locale: text(data.locale) || DEFAULT_LOCALE,
    whatsappCountryCode:
      text(data.whatsapp_country_code) || DEFAULT_WHATSAPP_COUNTRY_CODE,
    slotStepMin: numberValue(data.slot_step_min),
    bufferMin: numberValue(data.buffer_min),
    leadTimeMin: numberValue(data.lead_time_min),
    bookingWindowDays: numberValue(data.booking_window_days),
  };
}

export async function fetchBusinessHours(): Promise<BusinessHour[]> {
  const { data, error } = await supabase
    .from("business_hours")
    .select("*")
    .order("weekday", { ascending: true });

  if (error) fail(error);

  return ((data ?? []) as Row[]).map((row) => ({
    id: text(row.id),
    weekday: numberValue(row.weekday),
    openMinute: numberValue(row.open_minute),
    closeMinute: numberValue(row.close_minute),
    active: boolValue(row.active),
  }));
}

/** Actualiza los ajustes globales. Solo administradores (RLS). */
export async function updateShop(input: Record<string, unknown>) {
  const { error } = await supabase
    .from("shop_setting")
    .update(input)
    .eq("id", 1);

  if (error) fail(error);
}

/**
 * Guarda el horario semanal completo.
 * Se usa `upsert` porque cada día es una fila identificada por `weekday`.
 */
export async function updateHours(
  rows: {
    weekday: number;
    openMinute: number;
    closeMinute: number;
    active: boolean;
  }[],
) {
  const { error } = await supabase.from("business_hours").upsert(
    rows.map((row) => ({
      weekday: row.weekday,
      open_minute: row.openMinute,
      close_minute: row.closeMinute,
      active: row.active,
    })),
    { onConflict: "weekday" },
  );

  if (error) fail(error);
}
