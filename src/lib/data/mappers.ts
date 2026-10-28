/**
 * Mapeadores de filas de Supabase a los tipos del dominio.
 *
 * RESPONSABILIDAD
 * Aislar el formato de la base (`snake_case`, columnas anulables) del formato
 * que consumen las pantallas (`camelCase`, valores por defecto).
 *
 * INVARIANTE
 * Un campo ausente nunca debe romper la interfaz: los textos devuelven cadena
 * vacía y los números devuelven cero.
 */

import type {
  Appointment,
  AppointmentStatus,
  Barber,
  Client,
  HaircutIdea,
  Profile,
  Service,
} from "../types";
import {
  boolValue,
  nullableText,
  numberValue,
  text,
  type Row,
} from "./rows";

const DEFAULT_BARBER_COLOR = "#c2703d";

export function mapProfile(row: Row): Profile {
  return {
    id: text(row.id),
    name: text(row.name),
    email: text(row.email),
    role: row.role === "ADMIN" ? "ADMIN" : "BARBER",
    phone: nullableText(row.phone),
    bio: nullableText(row.bio),
    color: text(row.color) || DEFAULT_BARBER_COLOR,
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
    color: text(row.color) || DEFAULT_BARBER_COLOR,
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
          color: text(preferred.color) || DEFAULT_BARBER_COLOR,
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
