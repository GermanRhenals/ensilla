/**
 * Envío de correos transaccionales de las Edge Functions.
 *
 * Se usa Brevo cuando `BREVO_API_KEY` está configurada y Resend en caso
 * contrario. Brevo permite operar sin dominio propio: reescribe el remitente
 * por uno de su dominio, así que sirve para pruebas y para un despliegue
 * pequeño sin comprar dominio. Resend exige un dominio verificado y solo
 * entrega a direcciones arbitrarias cuando lo hay.
 *
 * Las claves viven únicamente en el entorno de Supabase. Ningún detalle del
 * proveedor (que puede incluir direcciones de correo) se devuelve al navegador.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
};

/** Indica si hay algún proveedor configurado antes de intentar enviar. */
export function hasEmailProvider() {
  return Boolean(
    Deno.env.get("BREVO_API_KEY") || Deno.env.get("RESEND_API_KEY"),
  );
}

/** Devuelve `true` solo si el proveedor aceptó el mensaje. */
export async function sendEmail(message: EmailMessage) {
  const brevoKey = Deno.env.get("BREVO_API_KEY");

  if (brevoKey) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: message.fromName, email: message.fromEmail },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });

    return response.ok;
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${message.fromName} <${message.fromEmail}>`,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  return response.ok;
}
