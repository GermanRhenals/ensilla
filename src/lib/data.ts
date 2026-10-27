import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  DEFAULT_WHATSAPP_COUNTRY_CODE,
} from "./constants";
import {
  addDaysToKey,
  parseDateKey,
  todayKey,
} from "./datetime";
import { supabase } from "./supabase";
import type {
  Appointment,
  AppointmentDetail,
  AppointmentStatus,
  Barber,
  BusinessHour,
  Client,
  ClientDetail,
  ConfirmationPayload,
  HaircutIdea,
  Notification,
  Profile,
  Service,
  Shop,
} from "./types";

type Row = Record<string, unknown>;

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

const APPOINTMENT_SELECT = `
  *,
  client:clients(*),
  service:services(*),
  barber:profiles!appointments_barber_id_fkey(*)
`;

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function boolValue(value: unknown) {
  return value === true;
}

function fail(error: { message: string } | null): never {
  throw new Error(error?.message ?? "No se pudo completar la operación.");
}

export function mapProfile(row: Row): Profile {
  return {
    id: text(row.id),
    name: text(row.name),
    email: text(row.email),
    role: row.role === "ADMIN" ? "ADMIN" : "BARBER",
    phone: nullableText(row.phone),
    bio: nullableText(row.bio),
    color: text(row.color) || "#c2703d",
    active: boolValue(row.active),
    createdAt: text(row.created_at),
  };
}

export function mapBarber(row: Row): Barber {
  return {
    id: text(row.id),
    name: text(row.name),
    email: text(row.email),
    role: row.role === "ADMIN" ? "ADMIN" : "BARBER",
    bio: nullableText(row.bio),
    color: text(row.color) || "#c2703d",
    phone: nullableText(row.phone),
    active: row.active === undefined ? true : boolValue(row.active),
    createdAt: text(row.created_at),
  };
}

export function mapService(row: Row): Service {
  return {
    id: text(row.id),
    name: text(row.name),
    description: nullableText(row.description),
    durationMin: numberValue(row.duration_min),
    priceCents: numberValue(row.price_cents),
    active: boolValue(row.active),
    sortOrder: numberValue(row.sort_order),
  };
}

export function mapClient(row: Row): Client {
  const preferred = row.preferred_barber as Row | null | undefined;
  return {
    id: text(row.id),
    name: text(row.name),
    phone: text(row.phone),
    email: nullableText(row.email),
    birthDate: nullableText(row.birth_date),
    notes: nullableText(row.notes),
    hairType: nullableText(row.hair_type),
    preferredStyle: nullableText(row.preferred_style),
    products: nullableText(row.products),
    allergies: nullableText(row.allergies),
    preferredBarberId: nullableText(row.preferred_barber_id),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    preferredBarber: preferred
      ? {
          id: text(preferred.id),
          name: text(preferred.name),
          color: text(preferred.color) || "#c2703d",
        }
      : null,
  };
}

export function mapIdea(row: Row): HaircutIdea {
  const createdBy = row.created_by as Row | null | undefined;
  return {
    id: text(row.id),
    title: text(row.title),
    description: text(row.description),
    tags: nullableText(row.tags),
    clientId: text(row.client_id),
    createdById: nullableText(row.created_by_id),
    createdAt: text(row.created_at),
    createdBy: createdBy ? { name: text(createdBy.name) } : null,
  };
}

export function mapAppointment(row: Row): Appointment {
  const client = row.client as Row | null | undefined;
  const service = row.service as Row | null | undefined;
  const barber = row.barber as Row | null | undefined;

  return {
    id: text(row.id),
    clientId: text(row.client_id),
    barberId: text(row.barber_id),
    serviceId: text(row.service_id),
    start: text(row.start_at),
    end: text(row.end_at),
    status: text(row.status) as AppointmentStatus,
    priceCents: numberValue(row.price_cents),
    notes: nullableText(row.notes),
    source: row.source === "STAFF" ? "STAFF" : "PUBLIC",
    reminderSentAt: nullableText(row.reminder_sent_at),
    createdAt: text(row.created_at),
    client: client ? mapClient(client) : null,
    service: service ? mapService(service) : null,
    barber: barber ? mapBarber(barber) : null,
  };
}

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

export async function fetchPublicBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("barbers_public")
    .select("*")
    .order("role", { ascending: true })
    .order("name", { ascending: true });
  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapBarber);
}

export async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapBarber);
}

export async function fetchServices(activeOnly = false): Promise<Service[]> {
  let query = supabase.from("services").select("*").order("sort_order", {
    ascending: true,
  });
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

export async function fetchClients(query = ""): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*, preferred_barber:profiles!clients_preferred_barber_id_fkey(id,name,color)")
    .order("name", { ascending: true })
    .limit(300);
  if (error) fail(error);

  const clients = ((data ?? []) as Row[]).map(mapClient);
  const term = query.trim().toLowerCase();
  if (!term) return clients;
  const digits = term.replace(/\D/g, "");

  return clients.filter(
    (client) =>
      client.name.toLowerCase().includes(term) ||
      (digits.length > 0 && client.phone.includes(digits)) ||
      (client.email ?? "").toLowerCase().includes(term),
  );
}

export async function fetchClientStats() {
  const { data, error } = await supabase
    .from("appointments")
    .select("client_id,price_cents,start_at")
    .eq("status", "COMPLETED");
  if (error) fail(error);

  const map = new Map<string, { spent: number; last: string | null }>();
  for (const row of (data ?? []) as Row[]) {
    const id = text(row.client_id);
    const current = map.get(id) ?? { spent: 0, last: null };
    current.spent += numberValue(row.price_cents);
    const start = text(row.start_at);
    if (start && (!current.last || start > current.last)) current.last = start;
    map.set(id, current);
  }
  return map;
}

export async function fetchClientDetail(id: string): Promise<ClientDetail | null> {
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

export async function fetchAppointmentsBetween(
  startIso: string,
  endIso: string,
  barberIds?: string[],
) {
  let request = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .lt("start_at", endIso)
    .gt("end_at", startIso)
    .order("start_at", { ascending: true });
  if (barberIds && barberIds.length > 0) request = request.in("barber_id", barberIds);
  const { data, error } = await request;
  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapAppointment);
}

export async function fetchAppointmentsSince(
  startIso: string,
  endIso: string,
  barberId?: string,
) {
  let request = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .gte("start_at", startIso)
    .lte("start_at", endIso);
  if (barberId) request = request.eq("barber_id", barberId);
  const { data, error } = await request;
  if (error) fail(error);
  return ((data ?? []) as Row[]).map(mapAppointment);
}

export async function fetchCompletedCount(clientId: string) {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "COMPLETED");
  if (error) fail(error);
  return count ?? 0;
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(60);
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
  return count ?? 0;
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

export async function fetchBarberCompletedCount(barberId: string) {
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", barberId)
    .eq("status", "COMPLETED");
  if (error) fail(error);
  return count ?? 0;
}

export async function fetchBarberWorkload() {
  const { data, error } = await supabase
    .from("appointments")
    .select("barber_id");
  if (error) fail(error);
  const map = new Map<string, number>();
  for (const row of (data ?? []) as Row[]) {
    const id = text(row.barber_id);
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export async function fetchClientWorkload() {
  const { data, error } = await supabase
    .from("appointments")
    .select("client_id");
  if (error) fail(error);
  const map = new Map<string, number>();
  for (const row of (data ?? []) as Row[]) {
    const id = text(row.client_id);
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
    if (error.code === "23505") throw new Error("Ya existe un cliente con ese teléfono.");
    fail(error);
  }
  return text((data as Row).id);
}

export async function updateClientRecord(id: string, input: Record<string, unknown>) {
  const { error } = await supabase.from("clients").update(input).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un cliente con ese teléfono.");
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
  const { error } = await supabase.from("haircut_ideas").delete().eq("id", id);
  if (error) fail(error);
}

export async function createService(input: {
  name: string;
  description?: string;
  durationMin: number;
  priceCents: number;
}) {
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

export async function updateService(id: string, input: Record<string, unknown>) {
  const { error } = await supabase.from("services").update(input).eq("id", id);
  if (error) fail(error);
}

export async function toggleService(id: string, active: boolean) {
  const { error } = await supabase.from("services").update({ active }).eq("id", id);
  if (error) fail(error);
}

export async function updateShop(input: Record<string, unknown>) {
  const { error } = await supabase.from("shop_setting").update(input).eq("id", 1);
  if (error) fail(error);
}

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

export async function toggleBarber(id: string, active: boolean) {
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) fail(error);
}

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

export async function createBarber(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  bio?: string;
  color: string;
  role: "ADMIN" | "BARBER";
}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "create", ...input },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

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
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "update", ...input },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

export async function fetchConfirmation(
  id: string,
): Promise<ConfirmationPayload | null> {
  const { data, error } = await supabase.rpc("get_booking_confirmation", {
    p_id: id,
  });
  if (error) fail(error);
  return (data as ConfirmationPayload | null) ?? null;
}
