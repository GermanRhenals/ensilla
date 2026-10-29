/**
 * Edge Function · recordatorio de una reserva por correo.
 *
 * RESPONSABILIDAD
 * Recibir el UUID de un turno, componer el correo con los datos de su
 * barbería y enviarlo. Después marca `reminder_sent_at`.
 *
 * SEGURIDAD
 * - El UUID de la reserva es la credencial, igual que en la página de
 *   confirmación. No se acepta ningún otro dato del cliente.
 * - El correo del cliente se lee con la clave de servicio y nunca se devuelve
 *   al navegador.
 * - Solo se envían recordatorios de turnos pendientes o confirmados.
 * - Se evita el reenvío inmediato para no convertir el botón en un amplificador
 *   de spam.
 * - La clave de servicio y las del proveedor de correo viven en el entorno de
 *   Supabase.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { hasEmailProvider, sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Espera mínima entre envíos del mismo turno. */
const REMINDER_COOLDOWN_MS = 2 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  const appointmentId = String(body.appointmentId ?? "").trim();
  if (!UUID_PATTERN.test(appointmentId)) {
    return json({ error: "La reserva no es válida." }, 400);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select(
      "id,shop_id,client_id,service_id,barber_id,start_at,status,reminder_sent_at",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (appointmentError) {
    return json({ error: "No se pudo leer la reserva." }, 500);
  }
  if (!appointment) {
    return json({ error: "No encontramos esa reserva." }, 404);
  }
  if (!["PENDING", "CONFIRMED"].includes(String(appointment.status))) {
    return json(
      { error: "Esta reserva ya no admite recordatorios." },
      400,
    );
  }

  if (appointment.reminder_sent_at) {
    const sentAt = new Date(String(appointment.reminder_sent_at)).getTime();
    if (Number.isFinite(sentAt) && Date.now() - sentAt < REMINDER_COOLDOWN_MS) {
      return json({ ok: true, alreadySent: true });
    }
  }

  const [clientResult, serviceResult, barberResult, shopResult] =
    await Promise.all([
      admin
        .from("clients")
        .select("name,email")
        .eq("id", appointment.client_id)
        .maybeSingle(),
      admin
        .from("services")
        .select("name")
        .eq("id", appointment.service_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("name")
        .eq("id", appointment.barber_id)
        .maybeSingle(),
      admin
        .from("shops")
        .select("name,address,timezone,locale,whatsapp,whatsapp_country_code")
        .eq("id", appointment.shop_id)
        .maybeSingle(),
    ]);

  const client = clientResult.data;
  const service = serviceResult.data;
  const barber = barberResult.data;
  const shop = shopResult.data;

  if (!client?.email) {
    return json(
      {
        error:
          "Esta reserva no tiene correo. Agregalo en la confirmación y volvé a intentar.",
      },
      400,
    );
  }
  if (!service || !barber || !shop) {
    return json({ error: "La reserva está incompleta." }, 500);
  }
  if (!hasEmailProvider() || !fromEmail) {
    return json(
      { error: "El envío de correos todavía no está configurado." },
      500,
    );
  }

  const timezone = String(shop.timezone || "America/Bogota");
  const locale = String(shop.locale || "es-CO");
  const start = new Date(String(appointment.start_at));

  let dateLabel: string;
  try {
    dateLabel = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(start);
  } catch {
    dateLabel = new Intl.DateTimeFormat("es-CO", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Bogota",
    }).format(start);
  }

  const shopName = String(shop.name);
  const firstName = String(client.name).split(/\s+/)[0] || "hola";
  const subject = `Recordatorio: ${service.name} en ${shopName}`;

  const rows = [
    ["Barbería", shopName],
    ["Servicio", String(service.name)],
    ["Barbero", String(barber.name)],
    ["Fecha", dateLabel],
    shop.address ? ["Dirección", String(shop.address)] : null,
  ].filter((row): row is [string, string] => row !== null);

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f5efe6;font-family:Georgia,serif;color:#1f1a17;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#fffdf8;border:1px solid #e6d9c6;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b06434;">Recordatorio de turno</p>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;">Hola ${escapeHtml(firstName)}, te esperamos.</h1>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#5b524a;">
                  Este es un recordatorio de tu reserva en <strong>${escapeHtml(shopName)}</strong>.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;border-top:1px solid #eee3d3;">
                  ${rows
                    .map(
                      ([label, value]) => `<tr>
                    <td style="padding:10px 0;color:#8a7d70;width:110px;">${escapeHtml(label)}</td>
                    <td style="padding:10px 0;font-weight:600;">${escapeHtml(value)}</td>
                  </tr>`,
                    )
                    .join("")}
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5b524a;">
                  Si necesitás cambiar o cancelar el turno, comunicate con la barbería.
                </p>
              </td>
            </tr>
          </table>
          <p style="max-width:520px;margin:16px auto 0;font-family:Arial,sans-serif;font-size:11px;color:#9b8c7d;text-align:center;">
            Enviado por En-silla a pedido de ${escapeHtml(shopName)}.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Recordatorio de turno en ${shopName}`,
    "",
    `Hola ${firstName}, te esperamos.`,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Si necesitás cambiar o cancelar el turno, comunicate con la barbería.",
  ].join("\n");

  const sent = await sendEmail({
    to: String(client.email),
    subject,
    html,
    text,
    fromName: fromName || shopName,
    fromEmail,
  });

  if (!sent) {
    // El detalle del proveedor puede contener direcciones de correo: no se
    // devuelve al navegador ni se registra.
    return json(
      { error: "No se pudo enviar el correo. Intentá de nuevo más tarde." },
      502,
    );
  }

  await admin
    .from("appointments")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", appointmentId);

  return json({ ok: true });
});
