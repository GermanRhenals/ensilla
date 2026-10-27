export const DEFAULT_TIMEZONE =
  process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "America/Bogota";
export const DEFAULT_CURRENCY =
  process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "COP";
export const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "es-CO";
export const DEFAULT_WHATSAPP_COUNTRY_CODE =
  process.env.NEXT_PUBLIC_DEFAULT_WHATSAPP_COUNTRY_CODE ?? "57";

export const SPANISH_LOCALES = [
  { value: "es", label: "Español (genérico)" },
  { value: "es-AR", label: "Argentina — ARS" },
  { value: "es-BO", label: "Bolivia — BOB" },
  { value: "es-CL", label: "Chile — CLP" },
  { value: "es-CO", label: "Colombia — COP" },
  { value: "es-CR", label: "Costa Rica — CRC" },
  { value: "es-CU", label: "Cuba — CUP" },
  { value: "es-DO", label: "República Dominicana — DOP" },
  { value: "es-EC", label: "Ecuador — USD" },
  { value: "es-ES", label: "España — EUR" },
  { value: "es-GQ", label: "Guinea Ecuatorial — XAF" },
  { value: "es-GT", label: "Guatemala — GTQ" },
  { value: "es-HN", label: "Honduras — HNL" },
  { value: "es-MX", label: "México — MXN" },
  { value: "es-NI", label: "Nicaragua — NIO" },
  { value: "es-PA", label: "Panamá — USD" },
  { value: "es-PE", label: "Perú — PEN" },
  { value: "es-PR", label: "Puerto Rico — USD" },
  { value: "es-PY", label: "Paraguay — PYG" },
  { value: "es-SV", label: "El Salvador — USD" },
  { value: "es-UY", label: "Uruguay — UYU" },
  { value: "es-VE", label: "Venezuela — VES" },
] as const;

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
  currency: DEFAULT_CURRENCY,
  timezone: DEFAULT_TIMEZONE,
  locale: DEFAULT_LOCALE,
  whatsappCountryCode: DEFAULT_WHATSAPP_COUNTRY_CODE,
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
