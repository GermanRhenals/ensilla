"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function safePath(value: string | null) {
  if (value && value.startsWith("/panel")) return value;
  return "/panel/notificaciones";
}

export async function markAllNotificationsReadAction(formData: FormData) {
  const user = await requireUser();
  const redirectTo = safePath(
    formData.get("redirectTo")
      ? String(formData.get("redirectTo"))
      : "/panel/notificaciones",
  );

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/panel", "layout");
  redirect(`${redirectTo}?ok=${encodeURIComponent("Notificaciones marcadas como leídas")}`);
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const redirectTo = safePath(
    formData.get("redirectTo")
      ? String(formData.get("redirectTo"))
      : "/panel/notificaciones",
  );

  if (id) {
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
  }

  revalidatePath("/panel", "layout");
  redirect(redirectTo);
}
