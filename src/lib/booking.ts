import { supabase } from "./supabase";
import type { BookingResult } from "./types";

export type { BookingResult };

export type PublicBookingInput = {
  serviceId: string;
  barberId: string;
  start: string;
  name: string;
  phone: string;
  email?: string;
  hairType?: string;
  preferredStyle?: string;
  notes?: string;
};

export type StaffBookingInput = {
  clientId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  barberId: string;
  serviceId: string;
  start: string;
  status?: string;
  notes?: string;
  source?: string;
};

export function normalizePhone(input: string) {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export async function createPublicBooking(
  input: PublicBookingInput,
): Promise<BookingResult> {
  const { data, error } = await supabase.rpc("create_public_booking", {
    p_service_id: input.serviceId,
    p_barber_id: input.barberId,
    p_start: input.start,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email || null,
    p_hair_type: input.hairType || null,
    p_preferred_style: input.preferredStyle || null,
    p_notes: input.notes || null,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.message ||
        "No se pudo crear la reserva. Probá con otro horario.",
    };
  }
  return { ok: true, appointmentId: String(data) };
}

export async function createStaffAppointment(
  input: StaffBookingInput,
): Promise<BookingResult> {
  const { data, error } = await supabase.rpc("create_staff_appointment", {
    p_client_id: input.clientId ?? null,
    p_client_name: input.clientName ?? null,
    p_client_phone: input.clientPhone ?? null,
    p_client_email: input.clientEmail ?? null,
    p_barber_id: input.barberId,
    p_service_id: input.serviceId,
    p_start: input.start,
    p_status: input.status ?? "CONFIRMED",
    p_notes: input.notes ?? null,
    p_source: input.source ?? "STAFF",
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "No se pudo crear el turno.",
    };
  }
  return { ok: true, appointmentId: String(data) };
}
