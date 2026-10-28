/**
 * Provisión de una barbería y su primer administrador.
 *
 * No existe registro público de barberías: cada alta se hace desde una máquina
 * con la clave de servicio. El script es idempotente por slug y nunca imprime
 * contraseñas.
 *
 * Uso:
 *   node scripts/create-shop.mjs --slug mi-barberia --name "Mi Barbería" \
 *     --admin-email admin@mi-barberia.com --admin-password "clave-segura"
 *
 * Para cambiar datos de una barbería existente, agregar `--update`.
 */

import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    name: { type: "string" },
    tagline: { type: "string" },
    description: { type: "string" },
    address: { type: "string" },
    phone: { type: "string" },
    whatsapp: { type: "string" },
    email: { type: "string" },
    instagram: { type: "string" },
    timezone: { type: "string" },
    currency: { type: "string" },
    locale: { type: "string" },
    "whatsapp-country-code": { type: "string" },
    "admin-name": { type: "string" },
    "admin-email": { type: "string" },
    "admin-password": { type: "string" },
    update: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const slug = values.slug?.trim();
const name = values.name?.trim();
const adminEmail = values["admin-email"]?.trim().toLowerCase();
const adminPassword = values["admin-password"];
const adminName = values["admin-name"]?.trim();

// El slug siempre identifica la barbería. En el alta, el nombre y el correo del
// primer administrador son obligatorios; en una actualización, ambos son
// opcionales y solo se tocan los datos enviados.
if (!slug) {
  console.error("Falta --slug.");
  process.exit(1);
}

if (!values.update && (!name || !adminEmail)) {
  console.error(
    "Faltan argumentos. Para crear una barbería: --slug, --name y --admin-email (más --admin-password si la cuenta es nueva).",
  );
  process.exit(1);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error(
    "El slug solo admite minúsculas, números y guiones simples, por ejemplo: barberia-del-parque.",
  );
  process.exit(1);
}

if (adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
  console.error("El correo del administrador no es válido.");
  process.exit(1);
}

if (adminPassword !== undefined && adminPassword.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/** Defaults de agenda: martes a viernes de 10 a 20, sábado de 9 a 18. */
const DEFAULT_HOURS = [
  { weekday: 0, open_minute: 0, close_minute: 0, active: false },
  { weekday: 1, open_minute: 0, close_minute: 0, active: false },
  { weekday: 2, open_minute: 600, close_minute: 1200, active: true },
  { weekday: 3, open_minute: 600, close_minute: 1200, active: true },
  { weekday: 4, open_minute: 600, close_minute: 1200, active: true },
  { weekday: 5, open_minute: 600, close_minute: 1200, active: true },
  { weekday: 6, open_minute: 540, close_minute: 1080, active: true },
];

async function upsertShop() {
  const { data: existing, error: findError } = await supabase
    .from("shops")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (findError) throw new Error(`shops: ${findError.message}`);

  if (existing && !values.update) {
    throw new Error(
      `La barbería "${slug}" ya existe. Usá --update si querés cambiar sus datos.`,
    );
  }

  // En una actualización solo se escriben los campos enviados: el resto
  // conserva lo que el administrador ya configuró desde el panel.
  const changes = {
    ...(name ? { name } : {}),
    ...(values.tagline !== undefined ? { tagline: values.tagline.trim() } : {}),
    ...(values.description !== undefined
      ? { description: values.description.trim() || null }
      : {}),
    ...(values.address !== undefined ? { address: values.address.trim() || null } : {}),
    ...(values.phone !== undefined ? { phone: values.phone.trim() || null } : {}),
    ...(values.whatsapp !== undefined
      ? { whatsapp: values.whatsapp.trim() || null }
      : {}),
    ...(values.email !== undefined ? { email: values.email.trim() || null } : {}),
    ...(values.instagram !== undefined
      ? { instagram: values.instagram.trim() || null }
      : {}),
    ...(values.timezone !== undefined ? { timezone: values.timezone.trim() } : {}),
    ...(values.currency !== undefined ? { currency: values.currency.trim() } : {}),
    ...(values.locale !== undefined ? { locale: values.locale.trim() } : {}),
    ...(values["whatsapp-country-code"] !== undefined
      ? { whatsapp_country_code: values["whatsapp-country-code"].trim() }
      : {}),
  };

  if (existing) {
    if (Object.keys(changes).length === 0) return existing;
    return must(
      supabase.from("shops").update(changes).eq("id", existing.id).select("*").single(),
      "shops update",
    );
  }

  if (!name) {
    throw new Error("El nombre es obligatorio para crear una barbería.");
  }
  if (!adminEmail) {
    throw new Error("Para crear una barbería necesitás --admin-email.");
  }

  return must(
    supabase
      .from("shops")
      .insert({
        slug,
        tagline: "Cortes con memoria",
        timezone: "America/Bogota",
        currency: "COP",
        locale: "es-CO",
        whatsapp_country_code: "57",
        ...changes,
        active: true,
      })
      .select("*")
      .single(),
    "shops insert",
  );
}

async function ensureHours(shopId) {
  const { count, error } = await supabase
    .from("business_hours")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);
  if (error) throw new Error(`business_hours: ${error.message}`);
  if ((count ?? 0) > 0) return false;

  await must(
    supabase
      .from("business_hours")
      .insert(DEFAULT_HOURS.map((row) => ({ ...row, shop_id: shopId }))),
    "business_hours insert",
  );
  return true;
}

async function ensureAdmin(shopId) {
  const list = await must(
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    "listUsers",
  );
  const existing = list.users.find(
    (user) => (user.email ?? "").toLowerCase() === adminEmail,
  );

  // Una cuenta de Auth solo puede pertenecer a una barbería. Evita que un
  // correo de otra barbería se reasigne por accidente desde este script.
  if (existing) {
    const { data: profile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("shop_id")
      .eq("id", existing.id)
      .maybeSingle();
    if (profileLookupError) {
      throw new Error(`profiles: ${profileLookupError.message}`);
    }
    if (profile?.shop_id && profile.shop_id !== shopId) {
      throw new Error(
        `El correo ${adminEmail} ya pertenece a otra barbería.`,
      );
    }
  }

  // En una actualización, no enviar `name` evita renombrar al administrador
  // con un valor por defecto. Si la cuenta es nueva, el trigger usa el prefijo
  // del correo cuando el nombre no viene.
  const metadata = {
    ...(adminName ? { name: adminName } : {}),
    shop_id: shopId,
  };

  let userId;
  if (existing) {
    const updated = await must(
      supabase.auth.admin.updateUserById(existing.id, {
        ...(adminPassword ? { password: adminPassword } : {}),
        email_confirm: true,
        user_metadata: metadata,
      }),
      "updateUser",
    );
    userId = updated.user.id;
  } else {
    if (!adminPassword) {
      throw new Error(
        "La cuenta de administrador no existe. Pasá --admin-password para crearla.",
      );
    }
    const created = await must(
      supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: metadata,
      }),
      "createUser",
    );
    userId = created.user.id;
  }

  // El trigger crea el perfil inactivo; este upsert lo deja como administrador
  // activo de la barbería recién provisionada.
  await must(
    supabase.from("profiles").upsert(
      {
        id: userId,
        shop_id: shopId,
        email: adminEmail,
        ...(adminName ? { name: adminName } : {}),
        role: "ADMIN",
        active: true,
      },
      { onConflict: "id" },
    ),
    "profiles upsert",
  );

  return { userId, created: !existing };
}

try {
  const shop = await upsertShop();
  const hoursCreated = await ensureHours(shop.id);
  const admin = adminEmail ? await ensureAdmin(shop.id) : null;

  console.log(`Barbería: ${shop.name}`);
  console.log(`Slug: ${shop.slug}`);
  console.log(`Reserva pública: /reservar?barberia=${shop.slug}`);
  console.log(
    `Horario semanal: ${hoursCreated ? "creado con los valores por defecto" : "conservado"}`,
  );
  if (admin) {
    console.log(
      `Administrador: ${adminEmail} (${admin.created ? "creado" : "actualizado"})`,
    );
  } else {
    console.log("Administrador: sin cambios (no se envió --admin-email)");
  }
  console.log("Revisá el horario y los servicios en Panel > Ajustes.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
