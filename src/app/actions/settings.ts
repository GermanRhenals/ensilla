"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { timeToMinutes } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { firstError, shopSchema } from "@/lib/validation";

function revalidateShop() {
  revalidatePath("/panel", "layout");
  revalidatePath("/");
  revalidatePath("/reservar");
}

export async function updateShopAction(formData: FormData) {
  await requireAdmin();

  const parsed = shopSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline"),
    description: formData.get("description"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    instagram: formData.get("instagram"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    slotStepMin: formData.get("slotStepMin"),
    bufferMin: formData.get("bufferMin"),
    leadTimeMin: formData.get("leadTimeMin"),
    bookingWindowDays: formData.get("bookingWindowDays"),
  });

  if (!parsed.success) {
    redirect(
      `/panel/ajustes?error=${encodeURIComponent(firstError(parsed.error))}`,
    );
  }

  const data = parsed.data;
  await prisma.shopSetting.upsert({
    where: { id: 1 },
    update: {
      name: data.name,
      tagline: data.tagline,
      description: data.description ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      email: data.email ?? null,
      instagram: data.instagram ?? null,
      currency: data.currency.toUpperCase(),
      timezone: data.timezone,
      slotStepMin: data.slotStepMin,
      bufferMin: data.bufferMin,
      leadTimeMin: data.leadTimeMin,
      bookingWindowDays: data.bookingWindowDays,
    },
    create: {
      id: 1,
      name: data.name,
      tagline: data.tagline,
      description: data.description ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      email: data.email ?? null,
      instagram: data.instagram ?? null,
      currency: data.currency.toUpperCase(),
      timezone: data.timezone,
      slotStepMin: data.slotStepMin,
      bufferMin: data.bufferMin,
      leadTimeMin: data.leadTimeMin,
      bookingWindowDays: data.bookingWindowDays,
    },
  });

  revalidateShop();
  redirect("/panel/ajustes?ok=Configuración%20guardada");
}

export async function updateHoursAction(formData: FormData) {
  await requireAdmin();

  const hours: {
    weekday: number;
    active: boolean;
    openMinute: number;
    closeMinute: number;
  }[] = [];

  for (let weekday = 0; weekday < 7; weekday++) {
    const active = formData.get(`active-${weekday}`) === "on";
    const open = timeToMinutes(String(formData.get(`open-${weekday}`) ?? ""));
    const close = timeToMinutes(String(formData.get(`close-${weekday}`) ?? ""));

    if (active && (open === null || close === null || open >= close)) {
      redirect(
        `/panel/ajustes?error=${encodeURIComponent("Revisá los horarios: la apertura debe ser anterior al cierre.")}`,
      );
    }

    hours.push({
      weekday,
      active,
      openMinute: open ?? 0,
      closeMinute: close ?? 0,
    });
  }

  await prisma.$transaction(
    hours.map((hour) =>
      prisma.businessHour.upsert({
        where: { weekday: hour.weekday },
        update: {
          active: hour.active,
          openMinute: hour.openMinute,
          closeMinute: hour.closeMinute,
        },
        create: hour,
      }),
    ),
  );

  revalidateShop();
  redirect("/panel/ajustes?ok=Horarios%20guardados");
}
