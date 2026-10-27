export const SHOP_TIMEZONE =
  process.env.SHOP_TIMEZONE ?? "America/Argentina/Buenos_Aires";

export const SESSION_COOKIE = "ensilla_session";
export const SESSION_DURATION_DAYS = 7;

export const APPOINTMENT_STATUS = {
  PENDING: {
    label: "Pendiente",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Confirmado",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  COMPLETED: {
    label: "Completado",
    badge: "bg-stone-100 text-stone-700 ring-stone-200",
    dot: "bg-stone-400",
  },
  CANCELLED: {
    label: "Cancelado",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-400",
  },
  NO_SHOW: {
    label: "No vino",
    badge: "bg-orange-50 text-orange-800 ring-orange-200",
    dot: "bg-orange-400",
  },
} as const;

export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS;

export const APPOINTMENT_STATUS_LIST = Object.keys(
  APPOINTMENT_STATUS,
) as AppointmentStatus[];

export const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"];

export const STAFF_ROLES = ["ADMIN", "BARBER"];

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const DEFAULT_SHOP = {
  name: "En-silla Barbershop",
  tagline: "Cortes con memoria",
  currency: "ARS",
  timezone: SHOP_TIMEZONE,
  slotStepMin: 15,
  bufferMin: 10,
  leadTimeMin: 60,
  bookingWindowDays: 21,
};

export function statusInfo(status: string) {
  return (
    APPOINTMENT_STATUS[status as AppointmentStatus] ??
    APPOINTMENT_STATUS.PENDING
  );
}

export function isValidStatus(value: string): value is AppointmentStatus {
  return APPOINTMENT_STATUS_LIST.includes(value as AppointmentStatus);
}
