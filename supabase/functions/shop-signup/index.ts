/**
 * Edge Function · alta autoservicio de una barbería.
 *
 * RESPONSABILIDAD
 * Crear la barbería oculta, la cuenta del dueño y enviar el enlace de
 * confirmación por correo. Es la única vía pública para crear un tenant.
 *
 * SEGURIDAD
 * - No confía en ningún `shop_id` del navegador: la barbería se crea en el
 *   servidor y el perfil se asocia a ese id.
 * - El registro libre de Supabase Auth sigue cerrado. El usuario se crea con
 *   `admin.generateLink({ type: "signup" })` y el enlace se envía por correo.
 * - El perfil nace inactivo y `pending_signup = true`; el trigger de Auth lo
 *   activa cuando el correo queda confirmado.
 * - Un correo pertenece a una sola cuenta. Se comprueba antes de crear nada.
 * - Límite por correo e IP para que el alta no sea un amplificador de correo.
 * - La clave de servicio y las del proveedor de correo viven solo en el
 *   entorno de Supabase.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { hasEmailProvider, sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt solo considera los primeros 72 bytes: aceptar más daría una falsa
// sensación de seguridad.
const MAX_PASSWORD_LENGTH = 72;
const MAX_NAME_LENGTH = 80;
const MAX_PHONE_LENGTH = 40;
const MAX_ATTEMPTS_PER_EMAIL = 3;
const MAX_ATTEMPTS_PER_IP = 10;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class ValidationError extends Error {}

function clean(value: unknown, maxLength: number) {
  const result = String(value ?? "").trim();
  if (result.length > maxLength) {
    throw new ValidationError(
      `El campo supera el máximo de ${maxLength} caracteres.`,
    );
  }
  return result;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function baseUrl(request: Request) {
  const configured = Deno.env.get("APP_BASE_URL")?.trim();
  const fallback = request.headers.get("origin")?.trim() ?? "";
  return (configured || fallback).replace(/\/+$/, "");
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("cf-connecting-ip") || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL");
  const fromName = Deno.env.get("REMINDER_FROM_NAME");

  if (!url || !serviceRoleKey) {
    return json({ error: "Faltan variables de entorno." }, 500);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  const action = String(body.action ?? "");

  async function tooManyAttempts(column: "email" | "ip", value: string) {
    const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
    const { count } = await admin
      .from("shop_signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq(column, value)
      .gte("created_at", since);

    return (
      (count ?? 0) >=
      (column === "email" ? MAX_ATTEMPTS_PER_EMAIL : MAX_ATTEMPTS_PER_IP)
    );
  }

  async function recordAttempt(
    email: string,
    ip: string | null,
    kind: "signup" | "resend",
  ) {
    await admin.from("shop_signup_attempts").insert({
      email,
      ip,
      action: kind,
    });
  }

  async function sendConfirmation(
    to: string,
    shopName: string,
    actionLink: string,
  ) {
    if (!hasEmailProvider() || !fromEmail) {
      return { ok: false, error: "El envío de correos no está configurado." };
    }

    const subject = `Confirmá tu correo para abrir ${shopName}`;
    const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f5efe6;font-family:Georgia,serif;color:#1f1a17;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#fffdf8;border:1px solid #e6d9c6;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b06434;">Alta de barbería</p>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;">Ya casi está lista.</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#5b524a;">
                  Recibimos el alta de <strong>${escapeHtml(shopName)}</strong>. Confirmá este correo para activar la cuenta del dueño y entrar al panel.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#1f1a17;color:#fffdf8;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;">
                    Confirmar correo
                  </a>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#5b524a;">
                  El enlace vence en una hora y se puede usar una sola vez. Si no pediste esta cuenta, ignorá el mensaje.
                </p>
              </td>
            </tr>
          </table>
          <p style="max-width:520px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:11px;color:#9b8c7d;text-align:center;">
            Enviado por En-silla.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = [
      `Confirmá tu correo para abrir ${shopName}`,
      "",
      "Recibimos el alta de tu barbería. Abrí este enlace para activar la cuenta del dueño:",
      actionLink,
      "",
      "El enlace vence en una hora y se puede usar una sola vez.",
      "Si no pediste esta cuenta, ignorá el mensaje.",
    ].join("\n");

    const sent = await sendEmail({
      to,
      subject,
      html,
      text,
      fromName: fromName || "En-silla",
      fromEmail,
    });

    if (!sent) {
      // El detalle del proveedor puede contener direcciones: no se devuelve ni
      // se registra.
      return { ok: false, error: "No se pudo enviar el correo." };
    }

    return { ok: true };
  }

  async function discardShop(shopId: string) {
    await admin.from("business_hours").delete().eq("shop_id", shopId);
    await admin.from("shops").delete().eq("id", shopId);
  }

  try {
    const email = clean(body.email, 160).toLowerCase();
    const ip = clientIp(request);

    if (!EMAIL_PATTERN.test(email)) {
      return json({ error: "Ingresá un correo válido." }, 400);
    }

    if (
      (await tooManyAttempts("email", email)) ||
      (ip !== null && (await tooManyAttempts("ip", ip)))
    ) {
      return json(
        {
          error:
            "Recibimos varios intentos con estos datos. Esperá una hora o escribinos.",
        },
        429,
      );
    }

    if (action === "resend") {
      await recordAttempt(email, ip, "resend");

      // Respuesta uniforme: no confirma si el correo existe o no.
      const { data: profile } = await admin
        .from("profiles")
        .select("id,pending_signup,active")
        .eq("email", email)
        .maybeSingle();

      if (!profile || !profile.pending_signup || profile.active) {
        return json({ ok: true });
      }

      const { data: userData } = await admin.auth.admin.getUserById(
        String(profile.id),
      );
      if (!userData?.user || userData.user.email_confirmed_at) {
        return json({ ok: true });
      }

      const redirectTo = `${baseUrl(request)}/confirmar/`;
      const link = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });

      if (link.error || !link.data?.properties?.action_link) {
        return json(
          { error: "No pudimos generar un enlace nuevo. Intentá más tarde." },
          500,
        );
      }

      const sent = await sendConfirmation(
        email,
        String(userData.user.user_metadata?.shop_name ?? "tu barbería"),
        link.data.properties.action_link,
      );

      if (!sent.ok) {
        return json(
          { error: "No se pudo enviar el correo. Intentá más tarde." },
          502,
        );
      }

      return json({ ok: true });
    }

    if (action !== "signup") {
      return json({ error: "Acción desconocida." }, 400);
    }

    const name = clean(body.name, MAX_NAME_LENGTH);
    const ownerName = clean(body.ownerName, MAX_NAME_LENGTH);
    const password = String(body.password ?? "");
    const phone = clean(body.phone, MAX_PHONE_LENGTH) || null;

    if (name.length < 2) {
      return json(
        { error: "El nombre de la barbería es obligatorio." },
        400,
      );
    }
    if (ownerName.length < 2) {
      return json({ error: "El nombre del responsable es obligatorio." }, 400);
    }
    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return json(
        {
          error: `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`,
        },
        400,
      );
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id,pending_signup,active")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.pending_signup && !existingProfile.active) {
        return json(
          {
            error:
              "Ya hay un registro pendiente para este correo. Revisá tu bandeja o pedí un enlace nuevo.",
            code: "pending",
          },
          409,
        );
      }
      return json(
        {
          error:
            "Ese correo ya tiene una cuenta. Ingresá al panel o recuperá tu contraseña.",
        },
        409,
      );
    }

    await recordAttempt(email, ip, "signup");

    const { data: createdShop, error: shopError } = await admin.rpc(
      "create_shop_signup",
      {
        p_name: name,
        p_owner_name: ownerName,
        p_email: email,
        p_phone: phone,
      },
    );

    if (shopError) {
      return json({ error: shopError.message }, 400);
    }

    const shop = createdShop as {
      id?: string;
      slug?: string;
      name?: string;
    } | null;

    if (!shop?.id || !shop.name) {
      return json({ error: "No se pudo crear la barbería." }, 500);
    }

    const redirectTo = `${baseUrl(request)}/confirmar/`;
    if (!baseUrl(request)) {
      await discardShop(shop.id);
      return json({ error: "El registro no está configurado." }, 500);
    }

    const link = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: {
          name: ownerName,
          shop_id: shop.id,
          shop_name: shop.name,
          shop_signup: true,
        },
        redirectTo,
      },
    });

    if (link.error || !link.data?.user) {
      await discardShop(shop.id);
      return json(
        {
          error:
            "No pudimos crear la cuenta. Revisá el correo o intentá con otro.",
        },
        400,
      );
    }

    const userId = link.data.user.id;

    // El trigger crea el perfil como BARBER inactivo. El alta autoservicio lo
    // convierte en el administrador pendiente de confirmar.
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        shop_id: shop.id,
        name: ownerName,
        role: "ADMIN",
        active: false,
        pending_signup: true,
      })
      .eq("id", userId);

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      await discardShop(shop.id);
      return json({ error: "No se pudo preparar la cuenta." }, 500);
    }

    const sent = await sendConfirmation(
      email,
      shop.name,
      link.data.properties.action_link,
    );

    if (!sent.ok) {
      // Se revierte todo para que la persona pueda reintentar el alta desde
      // cero en lugar de quedar con una cuenta a medias.
      await admin.auth.admin.deleteUser(userId);
      await discardShop(shop.id);
      return json(
        {
          error:
            "No pudimos enviar el correo de confirmación. Intentá de nuevo en unos minutos.",
        },
        502,
      );
    }

    return json({ ok: true, shopSlug: shop.slug });
  } catch (error) {
    const isValidation = error instanceof ValidationError;
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar el registro.",
      },
      isValidation ? 400 : 500,
    );
  }
});
