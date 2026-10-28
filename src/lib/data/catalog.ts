/**
 * Catálogo de servicios.
 *
 * RESPONSABILIDAD
 * Lectura pública (solo servicios activos) y administración del catálogo.
 *
 * SEGURIDAD
 * La lectura anónima pasa por RLS (`services_select`); la escritura es
 * exclusiva de administradores.
 */

import type { Service } from "../types";
import { supabase } from "../supabase";
import { fail, numberValue, nullableText, type Row } from "./rows";
import { mapService } from "./mappers";

export async function fetchServices(activeOnly = false): Promise<Service[]> {
  let query = supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true });

  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) fail(error);

  return ((data ?? []) as Row[]).map(mapService);
}

export async function fetchService(id: string): Promise<Service | null> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error);
  return data ? mapService(data) : null;
}

export async function createService(input: {
  name: string;
  description?: string;
  durationMin: number;
  priceCents: number;
}) {
  // El orden se calcula en el cliente porque el catálogo es pequeño y así se
  // evita una función RPC solo para esto.
  const { data, error } = await supabase
    .from("services")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) fail(error);
  const nextOrder = numberValue((data as Row | null)?.sort_order) + 1;

  const { error: insertError } = await supabase.from("services").insert({
    name: input.name.trim(),
    description: nullableText(input.description?.trim()),
    duration_min: input.durationMin,
    price_cents: input.priceCents,
    sort_order: nextOrder,
  });

  if (insertError) fail(insertError);
}

export async function updateService(
  id: string,
  input: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("services")
    .update(input)
    .eq("id", id);

  if (error) fail(error);
}

export async function toggleService(id: string, active: boolean) {
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", id);

  if (error) fail(error);
}
