"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import { requireUser } from "@/lib/auth";
import { createStaffAppointment } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { getShop } from "@/lib/shop";
import {
  appointmentNotesSchema,
  appointmentStatusSchema,
  firstError,
  staffAppointmentSchema,
} from "@/lib/validation";

function safePanelPath(value: string | null, fallback = "/panel/agenda") {
  if (value && value.startsWith("/panel")) return value;
  return fallback;
}

function revalidatePanel() {
  revalidatePath("/panel", "layout");
}

export async function createAppointmentAction(formData: FormData) {
  const user = await requireUser();
  const shop = await getShop();

  const parsed = staffAppointmentSchema.safeParse({
    clientId: formData.get("clientId"),
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    clientEmail: formData.get("clientEmail"),
    barberId: formData.get("barberId"),
    serviceId: formData.get("serviceId"),
    date: formData.get("date"),
    time: formData.get("time"),
    status: formData.get("status") ?? "CONFIRMED",
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    redirect(
      `/panel/citas/nueva?error=${encodeURIComponent(firstError(parsed.error))}`,
    );
  }

  const data = parsed.data;
  const barberId = user.role === "ADMIN" ? data.barberId : user.id;
  const start = fromZonedTime(
    `${data.date} ${data.time}:00`,
    shop.timezone,
  );

  const result = await createStaffAppointment({
    clientId: data.clientId,
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    clientEmail: data.clientEmail,
    barberId,
    serviceId: data.serviceId,
    start: start.toISOString(),
    status: data.status,
    notes: data.notes,
    source: "STAFF",
  });

  if (!result.ok) {
    redirect(
      `/panel/citas/nueva?error=${encodeURIComponent(result.error)}&date=${data.date}&time=${data.time}`,
    );
  }

  revalidatePanel();
  redirect(
    `/panel/citas/${result.appointmentId}?ok=${encodeURIComponent("Turno creado")}`,
  );
}

export async function updateAppointmentStatusAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const redirectTo = safePanelPath(
    formData.get("redirectTo") ? String(formData.get("redirectTo")) : null,
  );

  const parsedStatus = appointmentStatusSchema.safeParse(
    formData.get("status"),
  );
  if (!id || !parsedStatus.success) {
    redirect(
      `${redirectTo}?error=${encodeURIComponent("No se pudo actualizar el turno.")}`,
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
  });
  if (!appointment) {
    redirect(
      `${redirectTo}?error=${encodeURIComponent("El turno no existe.")}`,
    );
  }

  if (user.role !== "ADMIN" && appointment.barberId !== user.id) {
    redirect(
      `${redirectTo}?error=${encodeURIComponent("No podés modificar ese turno.")}`,
    );
  }

  await prisma.appointment.update({
    where: { id },
    data: { status: parsedStatus.data },
  });

  revalidatePanel();
  redirect(
    `${redirectTo}?ok=${encodeURIComponent("Turno actualizado")}`,
  );
}

export async function updateAppointmentNotesAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const redirectTo = safePanelPath(
    formData.get("redirectTo") ? String(formData.get("redirectTo")) : null,
    `/panel/citas/${id}`,
  );

  const parsed = appointmentNotesSchema.safeParse({
    notes: formData.get("notes"),
  });
  if (!id || !parsed.success) {
    redirect(
      `${redirectTo}?error=${encodeURIComponent("No se pudieron guardar las notas.")}`,
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
  });
  if (!appointment) {
    redirect(`${redirectTo}?error=${encodeURIComponent("El turno no existe.")}`);
  }
  if (user.role !== "ADMIN" && appointment.barberId !== user.id) {
    redirect(
      `${redirectTo}?error=${encodeURIComponent("No podés modificar ese turno.")}`,
    );
  }

  await prisma.appointment.update({
    where: { id },
    data: { notes: parsed.data.notes ?? null },
  });

  revalidatePanel();
  redirect(`${redirectTo}?ok=${encodeURIComponent("Notas guardadas")}`);
}

export async function markReminderSentAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const redirectTo = safePanelPath(
    formData.get("redirectTo") ? String(formData.get("redirectTo")) : null,
    `/panel/citas/${id}`,
  );

  if (!id) {
    redirect(`${redirectTo}?error=${encodeURIComponent("Turno inválido.")}`);
  }

  await prisma.appointment.update({
    where: { id },
    data: { reminderSentAt: new Date() },
  });

  revalidatePanel();
  redirect(
    `${redirectTo}?ok=${encodeURIComponent("Recordatorio marcado como enviado")}`,
  );
}
