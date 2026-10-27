"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authenticate,
  clearSessionCookie,
  requireUser,
  setSessionCookie,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { firstError, loginSchema, profileSchema } from "@/lib/validation";

function safeNext(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/panel";
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(firstError(parsed.error))}`);
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    const account = await prisma.user.findUnique({
      where: { email: parsed.data.email.trim().toLowerCase() },
      select: { active: true },
    });
    const attempted = parsed.data.email.trim().toLowerCase();
    const message = !account
      ? `No encontramos la cuenta "${attempted}". Usá el botón "Entrar como admin" o revisá que el dominio sea .app.`
      : account.active
        ? "La contraseña no es correcta. Revisá mayúsculas y espacios."
        : "Esa cuenta está desactivada. Hablá con un administrador.";
    redirect(
      `/login?error=${encodeURIComponent(message)}&email=${encodeURIComponent(parsed.data.email)}`,
    );
  }

  await setSessionCookie(user);
  redirect(safeNext(String(formData.get("next") ?? "/panel")));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    bio: formData.get("bio"),
    color: formData.get("color"),
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) {
    redirect(
      `/panel/perfil?error=${encodeURIComponent(firstError(parsed.error))}`,
    );
  }

  const { password, ...data } = parsed.data;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      phone: data.phone ?? null,
      bio: data.bio ?? null,
      color: data.color,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
  });

  revalidatePath("/panel", "layout");
  redirect("/panel/perfil?ok=Perfil%20actualizado");
}
