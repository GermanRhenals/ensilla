/**
 * Perfiles del equipo: barberos y administradores.
 *
 * RESPONSABILIDAD
 * - Lectura pública del equipo (vista `barbers_public`, sin correo ni teléfono).
 * - Lectura interna del plantel para el panel.
 * - Edición del perfil propio y administración de cuentas.
 *
 * SEGURIDAD
 * Los cambios de `role`, `active` y credenciales NO se hacen por UPDATE directo:
 * la migración de endurecimiento revocó esos privilegios de columna. Van por la
 * Edge Function `admin-users`, que valida que quien invoca sea administrador y
 * usa la clave de servicio.
 */

import type { Barber, Profile } from "../types";
import { supabase } from "../supabase";
import { fail, nullableText, numberValue, type Row } from "./rows";
import { mapBarber, mapProfile } from "./mappers";

/**
 * Invoca la Edge Function de administración y traduce sus errores.
 * Todas las acciones (`create`, `update`, `toggle`) comparten este contrato.
 */
async function invokeAdminUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
}

/**
 * Equipo visible en el sitio público de una barbería.
 * La vista ya filtra perfiles activos; el `shopId` es obligatorio para no
 * mezclar equipos de barberías distintas.
 */
export async function fetchPublicBarbers(shopId: string): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("barbers_public")
    .select("*")
    .eq("shop_id", shopId)
    .order("role", { ascending: true })
    .order("name", { ascending: true });

  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapBarber);
}

/** Plantel activo de la barbería actual, para selectores del panel. */
export async function fetchActiveBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapBarber);
}

/** Plantel completo, incluidos los perfiles desactivados. Solo personal. */
export async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapBarber);
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) fail(error);
  return data ? mapProfile(data) : null;
}

/** Edita solo los datos de presentación del perfil propio. */
export async function updateProfile(
  id: string,
  input: { name: string; phone?: string; bio?: string; color: string },
) {
  const { error } = await supabase
    .from("profiles")
    .update({
      name: input.name.trim(),
      phone: nullableText(input.phone?.trim()),
      bio: nullableText(input.bio?.trim()),
      color: input.color,
    })
    .eq("id", id);

  if (error) fail(error);
}

/** Crea la cuenta de Auth y su perfil en una sola operación administrativa. */
export async function createBarber(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  bio?: string;
  color: string;
  role: "ADMIN" | "BARBER";
}) {
  await invokeAdminUsers({ action: "create", ...input });
}

/** Actualiza la cuenta, incluidos credenciales, rol y estado. */
export async function updateBarber(input: {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  bio?: string;
  color: string;
  role: "ADMIN" | "BARBER";
  active: boolean;
}) {
  await invokeAdminUsers({ action: "update", ...input });
}

/**
 * Activa o desactiva a un miembro del equipo.
 * Un perfil inactivo no puede iniciar sesión ni recibir turnos nuevos, pero su
 * historial se conserva.
 */
export async function toggleBarber(id: string, active: boolean) {
  await invokeAdminUsers({ action: "toggle", id, active });
}

export async function fetchBarberCompletedCount(barberId: string) {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", barberId)
    .eq("status", "COMPLETED");

  if (error) fail(error);
  return numberValue(count);
}
