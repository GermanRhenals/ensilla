/**
 * Turnos (citas).
 *
 * RESPONSABILIDAD
 * Consultas de agenda, historial, detalle, mutaciones permitidas desde el panel
 * y lectura de la confirmación pública.
 *
 * SEGURIDAD
 * - El alta de turnos pasa por las RPC `create_public_booking` /
 *   `create_staff_appointment` (ver `src/lib/booking.ts`).
 * - Desde el panel solo se pueden actualizar `status`, `notes` y
 *   `reminder_sent_at`; el resto de columnas está revocado por la migración.
 * - La confirmación pública se lee por RPC y no expone datos del barbero.
 */

import { DEFAULT_TIMEZONE } from "../constants";
import { addDaysToKey, parseDateKey, todayKey } from "../datetime";
import type { AppointmentDetail, AppointmentStatus, ConfirmationPayload } from "../types";
import { supabase } from "../supabase";
import {
  APPOINTMENT_SELECT,
  fail,
  selectAllPages,
  text,
  type Row,
} from "./rows";
import { mapAppointment } from "./mappers";

/** Listado del panel de citas. El tope de 300 acota la vista, no los datos. */
export async function fetchAppointments({
  view,
  status,
  barberId,
  query,
  timezone = DEFAULT_TIMEZONE,
}: {
  view: string;
  status: string;
  barberId?: string;
  query: string;
  timezone?: string;
}): Promise<AppointmentDetail[]> {
  let request = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .order("start_at", { ascending: view !== "all" })
    .limit(300);

  if (barberId) request = request.eq("barber_id", barberId);
  if (status) request = request.eq("status", status);

  if (view === "today") {
    const today = todayKey(timezone);
    const tomorrow = addDaysToKey(today, 1, timezone);
    request = request
      .gte("start_at", parseDateKey(today, timezone).toISOString())
      .lt("start_at", parseDateKey(tomorrow, timezone).toISOString());
  }

  if (view === "upcoming") {
    request = request.gte("start_at", new Date().toISOString());
  }

  const { data, error } = await request;
  if (error) fail(error);

  const appointments = ((data ?? []) as Row[]).map(
    mapAppointment,
  ) as AppointmentDetail[];

  // La búsqueda se resuelve en memoria porque incluye nombre de cliente y de
  // servicio, que viven en tablas relacionadas.
  const term = query.trim().toLowerCase();
  if (!term) return appointments;

  const digits = term.replace(/\D/g, "");
  return appointments.filter((appointment) => {
    const client = appointment.client;
    const service = appointment.service;
    return (
      client.name.toLowerCase().includes(term) ||
      client.phone.toLowerCase().includes(digits || term) ||
      service.name.toLowerCase().includes(term)
    );
  });
}

export async function fetchAppointmentDetail(
  id: string,
): Promise<AppointmentDetail | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) fail(error);
  if (!data) return null;

  const appointment = mapAppointment(data as Row);
  if (!appointment.client || !appointment.service || !appointment.barber) {
    return null;
  }

  return appointment as AppointmentDetail;
}

/** Turnos que se solapan con un rango. Base de la agenda diaria. */
export async function fetchAppointmentsBetween(  startIso: string,
  endIso: string,
  barberIds?: string[],
) {
  let request = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .lt("start_at", endIso)
    .gt("end_at", startIso)
    .order("start_at", { ascending: true });

  if (barberIds) {
    // Un array vacío significa "ningún barbero": no debe degradar a "todos".
    if (barberIds.length === 0) return [];
    request = request.in("barber_id", barberIds);
  }

  const { data, error } = await request;
  if (error) fail(error);

  return ((data ?? []) as Row[]).map(mapAppointment);
}

/**
 * Turnos dentro de un rango de fechas (estadísticas).
 * Se pagina: un período largo supera holgadamente las mil filas.
 */
export async function fetchAppointmentsSince(
  startIso: string,
  endIso: string,
  barberId?: string,
) {
  const rows = await selectAllPages<Row>((from, to) => {
    let request = supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .gte("start_at", startIso)
      .lte("start_at", endIso)
      .order("start_at", { ascending: true });

    if (barberId) request = request.eq("barber_id", barberId);
    return request.range(from, to);
  });

  return rows.map(mapAppointment);
}

/** Cantidad total de turnos por barbero. */
export async function fetchBarberWorkload() {
  const rows = await selectAllPages<Row>((from, to) =>
    supabase
      .from("appointments")
      .select("barber_id")
      .order("id", { ascending: true })
      .range(from, to),
  );

  const map = new Map<string, number>();
  for (const row of rows) {
    const id = text(row.barber_id);
    map.set(id, (map.get(id) ?? 0) + 1);
  }

  return map;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
) {
  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id);

  if (error) fail(error);
}

export async function updateAppointmentNotes(id: string, notes: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ notes: notes.trim() || null })
    .eq("id", id);

  if (error) fail(error);
}

export async function markReminderSent(id: string) {
  const { error } = await supabase
    .from("appointments")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", id);

  if (error) fail(error);
}

/** Payload de la página pública de confirmación (UUID como credencial). */
export async function fetchConfirmation(
  id: string,
): Promise<ConfirmationPayload | null> {
  const { data, error } = await supabase.rpc("get_booking_confirmation", {
    p_id: id,
  });

  if (error) fail(error);
  return (data as ConfirmationPayload | null) ?? null;
}
