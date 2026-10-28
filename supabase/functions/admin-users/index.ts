/**
 * Edge Function · administración de cuentas del equipo.
 *
 * RESPONSABILIDAD
 * Crear, actualizar y activar/desactivar usuarios de Auth junto con su perfil.
 * Es la única vía para cambiar `role` o `active`: la migración de seguridad
 * revocó esos privilegios de columna para el cliente.
 *
 * SEGURIDAD
 * - Exige un JWT válido y comprueba que el perfil de quien invoca sea ADMIN
 *   activo (se consulta con la clave de servicio, sin confiar en el cliente).
 * - Nunca acepta `role` arbitrario: solo ADMIN o BARBER.
 * - Impide dejar la barbería sin ningún administrador activo.
 * - Acota cada lectura y escritura al `shop_id` del administrador que invoca.
 * - Valida y acota todos los campos antes de escribir.
 * - Usa `SUPABASE_SERVICE_ROLE_KEY`, que vive solo en el entorno de Supabase.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 80;
const MAX_BIO_LENGTH = 400;
const MAX_PHONE_LENGTH = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Error de datos enviados por el cliente.
 * Permite responder 400 sin confundirlo con una falla del servidor.
 */
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization") ?? "";

  if (!url || !anonKey || !serviceRoleKey) {
    return json({ error: "Faltan variables de entorno." }, 500);
  }
  if (!authorization.startsWith("Bearer ")) {
    return json({ error: "Sesión requerida." }, 401);
  }

  // Cliente con el JWT del llamante: solo sirve para identificarlo.
  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: caller, error: callerError } =
    await callerClient.auth.getUser();

  if (callerError || !caller.user) {
    return json({ error: "Sesión inválida." }, 401);
  }

  // Cliente con clave de servicio: nunca se expone al navegador.
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role,active,shop_id")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (
    !callerProfile ||
    callerProfile.role !== "ADMIN" ||
    !callerProfile.active ||
    !callerProfile.shop_id
  ) {
    return json({ error: "Solo un administrador puede hacer esto." }, 403);
  }

  // La barbería suspendida no puede administrar su equipo, igual que no puede
  // operar el panel: `current_shop_id()` también exige `active = true`.
  const { data: callerShop } = await admin
    .from("shops")
    .select("active")
    .eq("id", callerProfile.shop_id)
    .maybeSingle();

  if (!callerShop?.active) {
    return json({ error: "La barbería no está disponible." }, 403);
  }

  // Toda operación queda acotada a la barbería de quien invoca. El cliente
  // nunca envía `shop_id`: se deduce del perfil autenticado.
  const shopId = String(callerProfile.shop_id);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  const action = String(body.action ?? "");

  /**
   * Cuenta administradores activos distintos del indicado.
   * Sirve para garantizar que siempre quede al menos uno.
   */
  async function otherActiveAdmins(excludeId: string) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("role", "ADMIN")
      .eq("active", true)
      .neq("id", excludeId);

    return count ?? 0;
  }

  try {
    if (action === "create") {
      const name = clean(body.name, MAX_NAME_LENGTH);
      const email = clean(body.email, 160).toLowerCase();
      const password = String(body.password ?? "");
      const phone = clean(body.phone, MAX_PHONE_LENGTH) || null;
      const bio = clean(body.bio, MAX_BIO_LENGTH) || null;
      const color = String(body.color ?? "#3f7d6c");
      const role = body.role === "ADMIN" ? "ADMIN" : "BARBER";

      if (!name) return json({ error: "El nombre es obligatorio." }, 400);
      if (!EMAIL_PATTERN.test(email)) {
        return json({ error: "El email no es válido." }, 400);
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        return json(
          {
            error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
          },
          400,
        );
      }
      if (!COLOR_PATTERN.test(color)) {
        return json({ error: "El color debe tener formato #RRGGBB." }, 400);
      }

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          // `shop_id` viaja en los metadatos para que el trigger
          // `handle_new_user` cree el perfil en la barbería correcta.
          user_metadata: { name, shop_id: shopId },
        });

      if (createError) return json({ error: createError.message }, 400);

      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: created.user.id,
          shop_id: shopId,
          email,
          name,
          phone,
          bio,
          color,
          role,
          active: true,
        },
        { onConflict: "id" },
      );

      if (profileError) {
        // Si el perfil no se pudo crear, se revierte el usuario de Auth para no
        // dejar cuentas huérfanas.
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profileError.message }, 400);
      }

      return json({ id: created.user.id });
    }

    if (action === "update") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Falta el integrante." }, 400);

      const name = clean(body.name, MAX_NAME_LENGTH);
      const email = clean(body.email, 160).toLowerCase();
      const password = String(body.password ?? "");
      const phone = clean(body.phone, MAX_PHONE_LENGTH) || null;
      const bio = clean(body.bio, MAX_BIO_LENGTH) || null;
      const color = String(body.color ?? "#3f7d6c");
      const role = body.role === "ADMIN" ? "ADMIN" : "BARBER";
      const active = body.active !== false;

      if (!name) return json({ error: "El nombre es obligatorio." }, 400);
      if (!EMAIL_PATTERN.test(email)) {
        return json({ error: "El email no es válido." }, 400);
      }
      if (password && password.length < MIN_PASSWORD_LENGTH) {
        return json(
          {
            error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
          },
          400,
        );
      }
      if (!COLOR_PATTERN.test(color)) {
        return json({ error: "El color debe tener formato #RRGGBB." }, 400);
      }

      const { data: target } = await admin
        .from("profiles")
        .select("role,active,shop_id")
        .eq("id", id)
        .eq("shop_id", shopId)
        .maybeSingle();

      if (!target) return json({ error: "El integrante no existe." }, 404);

      const losesAdmin =
        target.role === "ADMIN" &&
        target.active &&
        (role !== "ADMIN" || !active);

      if (losesAdmin && (await otherActiveAdmins(id)) === 0) {
        return json(
          {
            error:
              "Debe quedar al menos un administrador activo. Asigná el rol a otra persona antes de cambiar este perfil.",
          },
          400,
        );
      }

      const { error: authError } = await admin.auth.admin.updateUserById(id, {
        email,
        email_confirm: true,
        ...(password ? { password } : {}),
        // `shop_id` se conserva en los metadatos: si más adelante se recrea el
        // perfil (por ejemplo, al repetir el alta), el trigger debe seguir
        // apuntando a la misma barbería.
        user_metadata: { name, shop_id: shopId },
      });
      if (authError) return json({ error: authError.message }, 400);

      const { error: profileError } = await admin
        .from("profiles")
        .update({ email, name, phone, bio, color, role, active })
        .eq("id", id)
        .eq("shop_id", shopId);
      if (profileError) return json({ error: profileError.message }, 400);

      return json({ id });
    }

    if (action === "toggle") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Falta el integrante." }, 400);
      if (typeof body.active !== "boolean") {
        return json({ error: "El estado es obligatorio." }, 400);
      }
      const active = body.active;

      const { data: target } = await admin
        .from("profiles")
        .select("role,active,shop_id")
        .eq("id", id)
        .eq("shop_id", shopId)
        .maybeSingle();

      if (!target) return json({ error: "El integrante no existe." }, 404);

      if (
        !active &&
        target.role === "ADMIN" &&
        target.active &&
        (await otherActiveAdmins(id)) === 0
      ) {
        return json(
          { error: "No podés desactivar al último administrador activo." },
          400,
        );
      }

      const { error: profileError } = await admin
        .from("profiles")
        .update({ active })
        .eq("id", id)
        .eq("shop_id", shopId);
      if (profileError) return json({ error: profileError.message }, 400);

      return json({ id, active });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (error) {
    const isValidation = error instanceof ValidationError;
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar la operación.",
      },
      isValidation ? 400 : 500,
    );
  }
});
