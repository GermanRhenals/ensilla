/**
 * Barberías y horario de atención.
 *
 * RESPONSABILIDAD
 * - Resolver la barbería del usuario autenticado (`current_shop`).
 * - Resolver una barbería pública por slug y buscarla por nombre.
 * - Leer el horario semanal y guardar los ajustes desde el panel.
 * - Pedir el alta autoservicio y publicar u ocultar la barbería.
 *
 * SEGURIDAD
 * La tabla `shops` está protegida por RLS. El slug no se puede cambiar desde
 * el navegador y la creación de barberías pasa por la Edge Function
 * `shop-signup`, que usa la clave de servicio. `published` no es una columna
 * editable: solo cambia por la RPC `set_shop_published`.
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
  // El fallback se usa mientras carga el panel: se asume publicada para no
  // mostrar el aviso de borrador antes de tener el dato real.
  published: true,
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

/**
 * Publica u oculta la barbería en el sitio público.
 *
 * La RPC exige el mínimo operativo (servicio, horario e integrante activos) y
 * es la única vía para escribir `published`; la columna no está otorgada al
 * navegador.
 */
export async function setShopPublished(published: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_shop_published", {
    p_published: published,
  });

  if (error) fail(error);
  return data === true;
}

/**
 * Error del alta autoservicio.
 * `code = "pending"` indica que el correo ya tiene un registro esperando
 * confirmación, para ofrecer el reenvío en lugar de un alta nueva.
 */
export class ShopSignupError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ShopSignupError";
    this.code = code;
  }
}

type ShopSignupPayload = {
  ok?: boolean;
  shopSlug?: string;
  error?: string;
  code?: string;
};

/**
 * Invoca la Edge Function de alta. Cuando la función responde con un código
 * distinto de 2xx, `functions.invoke` devuelve un error genérico; el mensaje
 * real viaja en el cuerpo y hay que leerlo de `data`.
 */
async function invokeShopSignup(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("shop-signup", {
    body,
  });
  const payload = (data ?? {}) as ShopSignupPayload;

  if (error || payload.error) {
    throw new ShopSignupError(
      payload.error
        ? String(payload.error)
        : "No pudimos completar el alta. Intentá de nuevo.",
      payload.code ? String(payload.code) : undefined,
    );
  }

  return payload;
}

/** Crea la barbería oculta y envía el enlace de confirmación al dueño. */
export async function requestShopSignup(input: {
  name: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const payload = await invokeShopSignup({ action: "signup", ...input });
  return {
    shopSlug: typeof payload.shopSlug === "string" ? payload.shopSlug : null,
  };
}

/**
 * Reenvía el enlace de confirmación. La función responde igual exista o no el
 * registro para no revelar qué correos están dados de alta.
 */
export async function resendShopSignup(email: string) {
  await invokeShopSignup({ action: "resend", email });
}
