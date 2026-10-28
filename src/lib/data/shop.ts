/**
 * Barberías y horario de atención.
 *
 * RESPONSABILIDAD
 * - Resolver la barbería del usuario autenticado (`current_shop`).
 * - Resolver una barbería pública por slug y buscarla por nombre.
 * - Leer el horario semanal y guardar los ajustes desde el panel.
 *
 * SEGURIDAD
 * La tabla `shops` está protegida por RLS. El slug no se puede cambiar desde
 * el navegador y la creación de barberías pasa por un script con service role.
 */

import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  DEFAULT_WHATSAPP_COUNTRY_CODE,
} from "../constants";
import type { BusinessHour, Shop, ShopSummary } from "../types";
import { supabase } from "../supabase";
import {
  boolValue,
  fail,
  numberValue,
  text,
  type Row,
} from "./rows";
import { mapShop, mapShopSummary } from "./mappers";

/**
 * Valores usados mientras cargan los ajustes o si todavía no hay barbería.
 * Un `id` vacío significa "sin barbería resuelta" y nunca se usa para escribir.
 */
export const FALLBACK_SHOP: Shop = {
  id: "",
  slug: "",
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
  active: true,
};

/** Barbería del usuario autenticado. La RPC respeta la RLS del perfil. */
export async function fetchShop(): Promise<Shop> {
  const { data, error } = await supabase.rpc("current_shop");

  if (error) fail(error);
  if (!data) return FALLBACK_SHOP;

  return mapShop(data as Row);
}

/** Barbería pública por slug. Devuelve null si no existe o está inactiva. */
export async function fetchShopBySlug(slug: string): Promise<Shop | null> {
  const clean = slug.trim();
  if (!clean) return null;

  const { data, error } = await supabase.rpc("get_public_shop", {
    p_slug: clean,
  });

  if (error) fail(error);
  return data ? mapShop(data as Row) : null;
}

/**
 * Búsqueda pública por nombre o slug.
 *
 * La RPC exige al menos dos caracteres: el visitante busca una barbería que ya
 * conoce, no recorre un directorio completo.
 */
export async function searchShops(query: string): Promise<ShopSummary[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const { data, error } = await supabase.rpc("search_shops", {
    p_query: clean,
  });

  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapShopSummary);
}

/** Horario semanal. En el panel se omite `shopId` y la RLS lo acota. */
export async function fetchBusinessHours(
  shopId?: string,
): Promise<BusinessHour[]> {
  let request = supabase
    .from("business_hours")
    .select("*")
    .order("weekday", { ascending: true });

  if (shopId) request = request.eq("shop_id", shopId);

  const { data, error } = await request;
  if (error) fail(error);

  return ((data ?? []) as Row[]).map((row) => ({
    id: text(row.id),
    weekday: numberValue(row.weekday),
    openMinute: numberValue(row.open_minute),
    closeMinute: numberValue(row.close_minute),
    active: boolValue(row.active),
  }));
}

/** Actualiza los ajustes de una barbería. Solo administradores (RLS). */
export async function updateShop(
  shopId: string,
  input: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("shops")
    .update(input)
    .eq("id", shopId);

  if (error) fail(error);
}

/**
 * Guarda el horario semanal completo.
 * La unicidad es `(shop_id, weekday)`, así que cada barbería mantiene su
 * propio calendario sin pisar el de las demás.
 */
export async function updateHours(
  shopId: string,
  rows: {
    weekday: number;
    openMinute: number;
    closeMinute: number;
    active: boolean;
  }[],
) {
  const { error } = await supabase.from("business_hours").upsert(
    rows.map((row) => ({
      shop_id: shopId,
      weekday: row.weekday,
      open_minute: row.openMinute,
      close_minute: row.closeMinute,
      active: row.active,
    })),
    { onConflict: "shop_id,weekday" },
  );

  if (error) fail(error);
}
