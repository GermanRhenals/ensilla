/**
 * Notificaciones internas del panel.
 *
 * RESPONSABILIDAD
 * Leer las notificaciones del usuario autenticado y marcar su estado de lectura.
 *
 * SEGURIDAD
 * Las notificaciones las genera el backend (RPC con `security definer`) o la
 * Edge Function. El cliente no puede insertar filas: la migración de
 * endurecimiento revocó el privilegio de INSERT.
 */

import type { Notification } from "../types";
import { supabase } from "../supabase";
import { fail, nullableText, numberValue, text, type Row } from "./rows";

const NOTIFICATION_LIMIT = 60;

export async function fetchNotifications(
  userId: string,
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_LIMIT);

  if (error) fail(error);

  return ((data ?? []) as Row[]).map((row) => ({
    id: text(row.id),
    userId: text(row.user_id),
    title: text(row.title),
    body: nullableText(row.body),
    href: nullableText(row.href),
    readAt: nullableText(row.read_at),
    createdAt: text(row.created_at),
  }));
}

export async function fetchUnreadCount(userId: string) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) fail(error);
  return numberValue(count);
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) fail(error);
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) fail(error);
}
