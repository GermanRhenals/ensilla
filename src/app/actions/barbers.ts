"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { barberSchema, firstError } from "@/lib/validation";

function parseBarber(formData: FormData) {
  return barberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
    bio: formData.get("bio"),
    color: formData.get("color"),
    password: formData.get("password") || undefined,
  });
}

function isUniqueError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function revalidateBarbers() {
  revalidatePath("/panel/barberos");
  revalidatePath("/panel", "layout");
  revalidatePath("/");
  revalidatePath("/reservar");
}

export async function createBarberAction(formData: FormData) {
  await requireAdmin();
  const parsed = parseBarber(formData);

  if (!parsed.success) {
    redirect(
      `/panel/barberos/nuevo?error=${encodeURIComponent(firstError(parsed.error))}`,
    );
  }

  if (!parsed.data.password) {
    redirect(
      `/panel/barberos/nuevo?error=${encodeURIComponent("Asigná una contraseña inicial.")}`,
    );
  }

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone ?? null,
        role: parsed.data.role,
        bio: parsed.data.bio ?? null,
        color: parsed.data.color,
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      redirect(
        `/panel/barberos/nuevo?error=${encodeURIComponent("Ese email ya está registrado.")}`,
      );
    }
    throw error;
  }

  revalidateBarbers();
  redirect("/panel/barberos?ok=Integrante%20creado");
}

export async function updateBarberAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = parseBarber(formData);
  const active = formData.get("active") === "on";

  if (!id || !parsed.success) {
    redirect(
      `/panel/barberos/${id}?error=${encodeURIComponent(parsed.success ? "Integrante inválido." : firstError(parsed.error))}`,
    );
  }

  if (id === admin.id && (!active || parsed.data.role !== "ADMIN")) {
    redirect(
      `/panel/barberos/${id}?error=${encodeURIComponent("No podés quitarte el acceso de administrador.")}`,
    );
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone ?? null,
        role: parsed.data.role,
        bio: parsed.data.bio ?? null,
        color: parsed.data.color,
        active,
        ...(parsed.data.password
          ? { passwordHash: await bcrypt.hash(parsed.data.password, 10) }
          : {}),
      },
    });
  } catch (error) {
    if (isUniqueError(error)) {
      redirect(
        `/panel/barberos/${id}?error=${encodeURIComponent("Ese email ya está registrado.")}`,
      );
    }
    throw error;
  }

  revalidateBarbers();
  redirect(`/panel/barberos/${id}?ok=${encodeURIComponent("Integrante actualizado")}`);
}

export async function toggleBarberAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/panel/barberos");

  if (id === admin.id) {
    redirect(
      `/panel/barberos?error=${encodeURIComponent("No podés desactivar tu propia cuenta.")}`,
    );
  }

  const barber = await prisma.user.findUnique({ where: { id } });
  if (!barber) redirect("/panel/barberos");

  await prisma.user.update({
    where: { id },
    data: { active: !barber.active },
  });

  revalidateBarbers();
  redirect(
    `/panel/barberos?ok=${encodeURIComponent(barber.active ? "Integrante desactivado" : "Integrante reactivado")}`,
  );
}
