export type AppRole = "ADMIN" | "BARBER";

export type Profile = {
  id: string;
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
  slotStepMin: number;
  bufferMin: number;
  leadTimeMin: number;
  bookingWindowDays: number;
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

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

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

export type ConfirmationPayload = {
  id: string;
  start_at: string;
  end_at: string;
  price_cents: number;
  status: AppointmentStatus;
  client: { name: string; phone: string };
  service: { name: string; duration_min: number };
  barber: { name: string; phone: string | null };
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  barberId: string;
  barberName: string;
  barberColor: string;
};
