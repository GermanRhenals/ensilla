import { dateKey, minutesOfDay } from "./datetime";
import { supabase } from "./supabase";
import type { AvailabilitySlot } from "./types";

export type { AvailabilitySlot };

type SlotRow = {
  start_at: string;
  end_at: string;
  barber_id: string;
  barber_name: string;
  barber_color: string;
};

export async function getAvailability({
  dayKey,
  serviceId,
  barberId,
}: {
  dayKey: string;
  serviceId: string;
  barberId?: string;
}): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase.rpc("get_availability", {
    p_date: dayKey,
    p_service_id: serviceId,
    p_barber_id: barberId ?? null,
  });
  if (error) throw new Error(error.message);

  return ((data ?? []) as SlotRow[]).map((slot) => ({
    start: slot.start_at,
    end: slot.end_at,
    barberId: slot.barber_id,
    barberName: slot.barber_name,
    barberColor: slot.barber_color,
  }));
}

export function slotDayKey(slot: { start: string }, timezone: string) {
  return dateKey(new Date(slot.start), timezone);
}

export function minutesOfSlot(start: Date, timezone: string) {
  return minutesOfDay(start, timezone);
}
