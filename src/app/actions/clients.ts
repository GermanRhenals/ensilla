"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { clientSchema, firstError, ideaSchema } from "@/lib/validation";

function birthDateToDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUniqueError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createClientAction(formData: FormData) {
  await requireUser();

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    birthDate: formData.get("birthDate"),
    hairType: formData.get("hairType"),
    preferredStyle: formData.get("preferredStyle"),
    products: formData.get("products"),
    allergies: formData.get("allergies"),
    notes: formData.get("notes"),
    preferredBarberId: formData.get("preferredBarberId"),
  });

  if (!parsed.success) {
    redirect(
      `/panel/clientes/nuevo?error=${encodeURIComponent(firstError(parsed.error))}`,
    );
  }

  const data = parsed.data;
  const phone = normalizePhone(data.phone);

  try {
    const client = await prisma.client.create({
      data: {
        name: data.name,
        phone,
        email: data.email ?? null,
        birthDate: birthDateToDate(data.birthDate),
        hairType: data.hairType ?? null,
        preferredStyle: data.preferredStyle ?? null,
        products: data.products ?? null,
        allergies: data.allergies ?? null,
        notes: data.notes ?? null,
        preferredBarberId: data.preferredBarberId ?? null,
      },
    });
    revalidatePath("/panel/clientes");
    redirect(
      `/panel/clientes/${client.id}?ok=${encodeURIComponent("Cliente creado")}`,
    );
  } catch (error) {
    if (isUniqueError(error)) {
      redirect(
        `/panel/clientes/nuevo?error=${encodeURIComponent("Ya existe un cliente con ese teléfono.")}`,
      );
    }
    throw error;
  }
}

export async function updateClientAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    birthDate: formData.get("birthDate"),
    hairType: formData.get("hairType"),
    preferredStyle: formData.get("preferredStyle"),
    products: formData.get("products"),
    allergies: formData.get("allergies"),
    notes: formData.get("notes"),
    preferredBarberId: formData.get("preferredBarberId"),
  });

  if (!id || !parsed.success) {
    redirect(
      `/panel/clientes/${id}?error=${encodeURIComponent(parsed.success ? "Cliente inválido." : firstError(parsed.error))}`,
    );
  }

  const data = parsed.data;

  try {
    await prisma.client.update({
      where: { id },
      data: {
        name: data.name,
        phone: normalizePhone(data.phone),
        email: data.email ?? null,
        birthDate: birthDateToDate(data.birthDate),
        hairType: data.hairType ?? null,
        preferredStyle: data.preferredStyle ?? null,
        products: data.products ?? null,
        allergies: data.allergies ?? null,
        notes: data.notes ?? null,
        preferredBarberId: data.preferredBarberId ?? null,
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      redirect(
        `/panel/clientes/${id}?error=${encodeURIComponent("Ese teléfono ya pertenece a otro cliente.")}`,
      );
    }
    throw error;
  }

  revalidatePath("/panel/clientes");
  revalidatePath(`/panel/clientes/${id}`);
  redirect(`/panel/clientes/${id}?ok=${encodeURIComponent("Ficha actualizada")}`);
}

export async function addIdeaAction(formData: FormData) {
  const user = await requireUser();
  const clientId = String(formData.get("clientId") ?? "");

  const parsed = ideaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    tags: formData.get("tags"),
  });

  if (!clientId || !parsed.success) {
    redirect(
      `/panel/clientes/${clientId}?error=${encodeURIComponent(parsed.success ? "Cliente inválido." : firstError(parsed.error))}#ideas`,
    );
  }

  await prisma.haircutIdea.create({
    data: {
      clientId,
      title: parsed.data.title,
      description: parsed.data.description,
      tags: parsed.data.tags ?? null,
      createdById: user.id,
    },
  });

  revalidatePath(`/panel/clientes/${clientId}`);
  redirect(
    `/panel/clientes/${clientId}?ok=${encodeURIComponent("Idea guardada")}#ideas`,
  );
}

export async function deleteIdeaAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");

  if (id && clientId) {
    await prisma.haircutIdea.deleteMany({ where: { id, clientId } });
  }

  revalidatePath(`/panel/clientes/${clientId}`);
  redirect(
    `/panel/clientes/${clientId}?ok=${encodeURIComponent("Idea eliminada")}#ideas`,
  );
}
