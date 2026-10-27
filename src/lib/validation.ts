import { z } from "zod";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .refine((value) => value === "" || emailPattern.test(value), {
    message: "Ingresá un email válido.",
  })
  .transform((value) => (value === "" ? undefined : value));

export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisá los datos ingresados.";
}

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Ingresá tu email."),
  password: z.string().min(1, "Ingresá tu contraseña."),
});

export const publicBookingSchema = z.object({
  serviceId: z.string().min(1, "Elegí un servicio."),
  barberId: z.string().min(1, "Elegí un barbero."),
  start: z.string().min(1, "Elegí un horario."),
  name: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre completo.")
    .max(80, "El nombre es demasiado largo."),
  phone: z
    .string()
    .trim()
    .min(6, "Ingresá un teléfono válido.")
    .max(30, "El teléfono es demasiado largo."),
  email: optionalEmail.optional(),
  hairType: optionalText(120),
  preferredStyle: optionalText(160),
  notes: optionalText(500),
});

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresá el nombre del cliente.")
    .max(80, "El nombre es demasiado largo."),
  phone: z
    .string()
    .trim()
    .min(6, "Ingresá un teléfono válido.")
    .max(30, "El teléfono es demasiado largo."),
  email: optionalEmail.optional(),
  birthDate: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Fecha inválida.",
    )
    .optional(),
  hairType: optionalText(120),
  preferredStyle: optionalText(160),
  products: optionalText(160),
  allergies: optionalText(200),
  notes: optionalText(600),
  preferredBarberId: optionalText(60),
});

export const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresá el nombre del servicio.")
    .max(80),
  description: optionalText(300),
  durationMin: z.coerce
    .number()
    .int("La duración debe ser en minutos.")
    .min(5, "La duración mínima es 5 minutos.")
    .max(480, "La duración máxima es 8 horas."),
  price: z.coerce
    .number()
    .min(0, "El precio no puede ser negativo.")
    .max(100000000),
});

export const barberSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre.").max(80),
  email: z
    .string()
    .trim()
    .min(3, "Ingresá el email.")
    .refine((value) => emailPattern.test(value), "Ingresá un email válido."),
  phone: optionalText(30),
  role: z.enum(["ADMIN", "BARBER"]),
  bio: optionalText(300),
  color: z
    .string()
    .trim()
    .refine((value) => /^#[0-9a-fA-F]{6}$/.test(value), "Color inválido."),
  password: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.length >= 6,
      "La contraseña debe tener al menos 6 caracteres.",
    ),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre.").max(80),
  phone: optionalText(30),
  bio: optionalText(300),
  color: z
    .string()
    .trim()
    .refine((value) => /^#[0-9a-fA-F]{6}$/.test(value), "Color inválido."),
  password: z
    .string()
    .optional()
    .refine(
      (value) => !value || value.length >= 6,
      "La contraseña debe tener al menos 6 caracteres.",
    ),
});

export const shopSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del local.").max(80),
  tagline: z.string().trim().min(2, "Ingresá un lema.").max(120),
  description: optionalText(600),
  address: optionalText(200),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  whatsappCountryCode: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Usá el código de país sin +."),
  email: optionalEmail.optional(),
  instagram: optionalText(80),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Usá un código ISO de 3 letras."),
  locale: z
    .string()
    .trim()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Usá un locale válido, ej. es-MX."),
  timezone: z.string().trim().min(3).max(80),
  slotStepMin: z.coerce.number().int().min(5).max(60),
  bufferMin: z.coerce.number().int().min(0).max(120),
  leadTimeMin: z.coerce.number().int().min(0).max(1440),
  bookingWindowDays: z.coerce.number().int().min(1).max(120),
});

export const appointmentStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const staffAppointmentSchema = z.object({
  clientId: optionalText(60),
  clientName: optionalText(80),
  clientPhone: optionalText(30),
  clientEmail: optionalEmail.optional(),
  barberId: z.string().min(1, "Elegí un barbero."),
  serviceId: z.string().min(1, "Elegí un servicio."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida."),
  status: appointmentStatusSchema,
  notes: optionalText(500),
});

export const appointmentNotesSchema = z.object({
  notes: optionalText(600),
});

export const ideaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Escribí un título para la idea.")
    .max(100, "El título es demasiado largo."),
  description: z
    .string()
    .trim()
    .min(10, "Contá un poco más sobre la idea.")
    .max(600, "La descripción es demasiado larga."),
  tags: optionalText(120),
});

