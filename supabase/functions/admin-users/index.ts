import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: caller, error: callerError } =
    await callerClient.auth.getUser();
  if (callerError || !caller.user) {
    return json({ error: "Sesión inválida." }, 401);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (
    !callerProfile ||
    callerProfile.role !== "ADMIN" ||
    !callerProfile.active
  ) {
    return json({ error: "Solo un administrador puede hacer esto." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  const action = String(body.action ?? "");
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const phone = String(body.phone ?? "").trim() || null;
  const bio = String(body.bio ?? "").trim() || null;
  const color = String(body.color ?? "#3f7d6c");
  const role = body.role === "ADMIN" ? "ADMIN" : "BARBER";

  if (!name || !email) {
    return json({ error: "Nombre y email son obligatorios." }, 400);
  }

  try {
    if (action === "create") {
      if (password.length < 6) {
        return json(
          { error: "La contraseña debe tener al menos 6 caracteres." },
          400,
        );
      }

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name },
        });
      if (createError) {
        return json({ error: createError.message }, 400);
      }

      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: created.user.id,
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
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: profileError.message }, 400);
      }

      return json({ id: created.user.id });
    }

    if (action === "update") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Falta el integrante." }, 400);

      const active = body.active !== false;
      const { error: authError } = await admin.auth.admin.updateUserById(id, {
        email,
        email_confirm: true,
        ...(password ? { password } : {}),
        user_metadata: { name },
      });
      if (authError) return json({ error: authError.message }, 400);

      const { error: profileError } = await admin
        .from("profiles")
        .update({ email, name, phone, bio, color, role, active })
        .eq("id", id);
      if (profileError) return json({ error: profileError.message }, 400);

      return json({ id });
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo completar la operación.",
      },
      500,
    );
  }
});
