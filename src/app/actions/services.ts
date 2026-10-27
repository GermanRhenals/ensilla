"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { firstError, serviceSchema } from "@/lib/validation";

function parseService(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    durationMin: formData.get("durationMin"),
    price: formData.get("price"),
  });
}

export async function createServiceAction(formData: FormData) {
  await requireAdmin();
  const parsed = parseService(formData);

  if (!parsed.success) {
    redirect(
      `/panel/servicios?error=${encodeURIComponent(firstError(parsed.error))}`,
    );
  }

  const max = await prisma.service.aggregate({ _max: { sortOrder: true } });
  await prisma.service.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      durationMin: parsed.data.durationMin,
      priceCents: Math.round(parsed.data.price * 100),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/panel/servicios");
  revalidatePath("/reservar");
  revalidatePath("/");
  redirect("/panel/servicios?ok=Servicio%20creado");
}

export async function updateServiceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = parseService(formData);

  if (!id || !parsed.success) {
    redirect(
      `/panel/servicios?error=${encodeURIComponent(parsed.success ? "Servicio inválido." : firstError(parsed.error))}`,
    );
  }

  await prisma.service.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      durationMin: parsed.data.durationMin,
      priceCents: Math.round(parsed.data.price * 100),
      active: formData.get("active") === "on",
    },
  });

  revalidatePath("/panel/servicios");
  revalidatePath("/reservar");
  revalidatePath("/");
  redirect("/panel/servicios?ok=Servicio%20actualizado");
}

export async function toggleServiceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/panel/servicios");

  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) redirect("/panel/servicios");

  await prisma.service.update({
    where: { id },
    data: { active: !service.active },
  });

  revalidatePath("/panel/servicios");
  revalidatePath("/reservar");
  revalidatePath("/");
  redirect(
    `/panel/servicios?ok=${encodeURIComponent(service.active ? "Servicio archivado" : "Servicio reactivado")}`,
  );
}
