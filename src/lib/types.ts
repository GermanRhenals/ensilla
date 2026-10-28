export type AppRole = "ADMIN" | "BARBER";

export type Profile = {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: AppRole;
  phone: string | null;
  bio: string | null;
  color: string;
  active: boolean;
  createdAt: string;
};

export type Shop = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  currency: string;
  timezone: string;
  locale: string;
  whatsappCountryCode: string;
  slotStepMin: number;
  bufferMin: number;
  leadTimeMin: number;
  bookingWindowDays: number;
  active: boolean;
};

/**
 * Barbería que devuelve la búsqueda pública. Es un subconjunto de `Shop`:
 * la portada no necesita reglas de agenda ni datos internos.
 */
export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  address: string | null;
  instagram: string | null;
};

export type BusinessHour = {
  id: string;
  weekday: number;
  openMinute: number;
  closeMinute: number;
  active: boolean;
};

export type Barber = {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: AppRole;
  bio: string | null;
  color: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  active: boolean;
  sortOrder: number;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  notes: string | null;
  hairType: string | null;
  preferredStyle: string | null;
  products: string | null;
  allergies: string | null;
  preferredBarberId: string | null;
  createdAt: string;
  updatedAt: string;
  preferredBarber?: Pick<Barber, "id" | "name" | "color"> | null;
  appointmentCount?: number;
};

/**
 * El estado de un turno se define una sola vez en `constants.ts`
 * (etiquetas, colores y lista válida). Aquí solo se reexporta el tipo.
 */
import type { AppointmentStatus } from "./constants";
export type { AppointmentStatus };

export type AppointmentSource = "PUBLIC" | "STAFF";

export type Appointment = {
  id: string;
  clientId: string;
  barberId: string;
  serviceId: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  priceCents: number;
  notes: string | null;
  source: AppointmentSource;
  reminderSentAt: string | null;
  createdAt: string;
  client?: Client | null;
  service?: Pick<Service, "id" | "name" | "durationMin" | "priceCents"> | null;
  barber?: Pick<Barber, "id" | "name" | "color"> | null;
};

export type HaircutIdea = {
  id: string;
  title: string;
  description: string;
  tags: string | null;
  clientId: string;
  createdById: string | null;
  createdAt: string;
  createdBy?: { name: string } | null;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ClientDetail = Client & {
  ideas: HaircutIdea[];
  appointments: Appointment[];
};

export type AppointmentDetail = Appointment & {
  client: Client;
  service: Service;
  barber: Barber;
};

export type BookingResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: string };

/**
 * Datos de la página de confirmación. La RPC entrega `snake_case` y el mapper
 * los traduce. El correo del cliente no se expone: solo `hasEmail`, que es lo
 * que la pantalla necesita para ofrecer el recordatorio.
 */
export type ConfirmationPayload = {
  id: string;
  start: string;
  end: string;
  priceCents: number;
  status: AppointmentStatus;
  client: { name: string; phone: string; hasEmail: boolean };
  service: { name: string; durationMin: number };
  barber: { name: string };
  shop: Shop;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  barberId: string;
  barberName: string;
  barberColor: string;
};
