/**
 * Clientes de la barbería.
 *
 * RESPONSABILIDAD
 * Lectura con búsqueda del lado del servidor, ficha completa con historial,
 * alta y edición de datos, e ideas de corte asociadas.
 *
 * SEGURIDAD
 * Toda la tabla está protegida por RLS para personal autenticado. El borrado
 * queda reservado a administradores y el historial de turnos impide borrar
 * clientes con citas (clave foránea `on delete restrict`).
 */

import type { Client, ClientDetail } from "../types";
import { supabase } from "../supabase";
import {
  APPOINTMENT_SELECT,
  fail,
  nullableText,
  numberValue,
  selectAllPages,
  text,
  type Row,
} from "./rows";
import { mapAppointment, mapClient, mapIdea } from "./mappers";

const CLIENT_SELECT =
  "*, preferred_barber:profiles!clients_preferred_barber_id_fkey(id,name,color)";

/**
 * Busca clientes por nombre, correo o teléfono.
 *
 * La búsqueda se resuelve en PostgREST (`ilike`) para no descargar toda la
 * tabla. Los caracteres con significado especial en la sintaxis `or` se
 * reemplazan por espacios para evitar filtros mal formados.
 */
export async function fetchClients(query = ""): Promise<Client[]> {
  let request = supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .order("name", { ascending: true })
    .limit(300);

  const term = query.trim();
  if (term) {
    const safe = term.replace(/[%,()*\\]/g, " ").trim();
    const digits = term.replace(/\D/g, "");
    const filters = [
      `name.ilike.%${safe}%`,
      `email.ilike.%${safe}%`,
    ];
    if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);
    request = request.or(filters.join(","));
  }

  const { data, error } = await request;
  if (error) fail(error);

  return ((data ?? []) as Row[]).map(mapClient);
}

/**
 * Totales gastados y última visita por cliente.
 * Se pagina porque un año de turnos supera el tope de mil filas.
 */
export async function fetchClientStats() {
  const rows = await selectAllPages<Row>((from, to) =>
    supabase
      .from("appointments")
      .select("client_id,price_cents,start_at")
      .eq("status", "COMPLETED")
      .order("start_at", { ascending: true })
      .range(from, to),
  );

  const map = new Map<string, { spent: number; last: string | null }>();

  for (const row of rows) {
    const id = text(row.client_id);
    const current = map.get(id) ?? { spent: 0, last: null };
    current.spent += numberValue(row.price_cents);

    const start = text(row.start_at);
    if (start && (!current.last || start > current.last)) current.last = start;

    map.set(id, current);
  }

  return map;
}

/** Ficha completa: datos, ideas y todos los turnos del cliente. */
export async function fetchClientDetail(
  id: string,
): Promise<ClientDetail | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      `*,
       preferred_barber:profiles!clients_preferred_barber_id_fkey(id,name,color),
       ideas:haircut_ideas(*,created_by:profiles!haircut_ideas_created_by_id_fkey(name)),
       appointments:appointments(${APPOINTMENT_SELECT})`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error);
  if (!data) return null;

  const row = data as Row;
  const ideas = ((row.ideas ?? []) as Row[])
    .map(mapIdea)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const appointments = ((row.appointments ?? []) as Row[])
    .map(mapAppointment)
    .sort((a, b) => b.start.localeCompare(a.start));

  return { ...mapClient(row), ideas, appointments };
}

/** Cantidad total de turnos por cliente (para la lista). */
export async function fetchClientWorkload() {
  const rows = await selectAllPages<Row>((from, to) =>
    supabase
      .from("appointments")
      .select("client_id")
      .order("id", { ascending: true })
      .range(from, to),
  );

  const map = new Map<string, number>();
  for (const row of rows) {
    const id = text(row.client_id);
    map.set(id, (map.get(id) ?? 0) + 1);
  }

  return map;
}

export async function createClientRecord(input: {
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  hairType?: string;
  preferredStyle?: string;
  products?: string;
  allergies?: string;
  notes?: string;
  preferredBarberId?: string;
}) {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name.trim(),
      phone: input.phone,
      email: nullableText(input.email?.trim()),
      birth_date: nullableText(input.birthDate),
      hair_type: nullableText(input.hairType?.trim()),
      preferred_style: nullableText(input.preferredStyle?.trim()),
      products: nullableText(input.products?.trim()),
      allergies: nullableText(input.allergies?.trim()),
      notes: nullableText(input.notes?.trim()),
      preferred_barber_id: nullableText(input.preferredBarberId),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un cliente con ese teléfono.");
    }
    fail(error);
  }

  return text((data as Row).id);
}

export async function updateClientRecord(
  id: string,
  input: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("clients")
    .update(input)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Ya existe un cliente con ese teléfono.");
    }
    fail(error);
  }
}

export async function addIdea(input: {
  clientId: string;
  title: string;
  description: string;
  tags?: string;
}) {
  const { error } = await supabase.from("haircut_ideas").insert({
    client_id: input.clientId,
    title: input.title.trim(),
    description: input.description.trim(),
    tags: nullableText(input.tags?.trim()),
  });

  if (error) fail(error);
}

export async function deleteIdea(id: string) {
  const { error } = await supabase
    .from("haircut_ideas")
    .delete()
    .eq("id", id);

  if (error) fail(error);
}
