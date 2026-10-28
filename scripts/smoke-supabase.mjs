/**
 * Prueba de humo contra un Supabase real.
 *
 * Verifica el flujo completo del marketplace: búsqueda pública, reserva en una
 * barbería, confirmación sin datos internos, correo posterior, aislamiento
 * entre barberías y administración de cuentas acotada por barbería.
 *
 * Crea datos temporales y los borra al final. No envía correos salvo que se
 * pase `SMOKE_SEND_REMINDER="true"` y la Edge Function tenga Resend
 * configurado.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error("Faltan variables de Supabase en .env");
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const service = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const suffix = randomBytes(3).toString("hex");
const testName = `Smoke Test ${suffix}`;
const testPhone = `99${Date.now().toString().slice(-8)}`;
const testEmail = `smoke-${suffix}@ensilla.test`;
const tempSlug = `smoke-${suffix}`;
const created = {
  appointments: [],
  clientId: null,
  userId: null,
  tempShopId: null,
  tempServiceId: null,
};
const startedAt = new Date().toISOString();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dateKey(date, timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function findSlot({ shopId, serviceId, barberId, timezone }) {
  for (let offset = 1; offset <= 21; offset += 1) {
    const day = dateKey(addDays(new Date(), offset), timezone);
    const { data, error } = await anon.rpc("get_availability", {
      p_shop_id: shopId,
      p_date: day,
      p_service_id: serviceId,
      p_barber_id: barberId ?? null,
    });
    if (error) throw error;
    if (data?.length) return data[0];
  }
  throw new Error("No hay horarios disponibles para probar.");
}

try {
  const shopSlug = process.env.SMOKE_SHOP_SLUG ?? "en-silla";
  const { data: shop, error: shopError } = await service
    .from("shops")
    .select("*")
    .eq("slug", shopSlug)
    .single();
  if (shopError) throw shopError;

  const [
    { data: services, error: serviceError },
    { data: barbers, error: barberError },
  ] = await Promise.all([
    anon
      .from("services")
      .select("*")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .limit(1),
    anon
      .from("barbers_public")
      .select("*")
      .eq("shop_id", shop.id)
      .limit(1),
  ]);
  if (serviceError) throw serviceError;
  if (barberError) throw barberError;

  const serviceRow = services?.[0];
  const barber = barbers?.[0];
  assert(serviceRow && barber, "Faltan datos base para la prueba.");
  console.log(`✓ datos públicos de ${shop.name}`);

  if (barber && ("email" in barber || "phone" in barber)) {
    throw new Error("barbers_public expone datos de contacto del equipo.");
  }
  console.log("✓ barbers_public sin correo ni teléfono");

  // Búsqueda por nombre: el visitante ya conoce la barbería.
  const searchTerm = shop.name.slice(0, Math.min(6, shop.name.length));
  const { data: results, error: searchError } = await anon.rpc("search_shops", {
    p_query: searchTerm,
  });
  if (searchError) throw searchError;
  assert(
    (results ?? []).some((row) => row.id === shop.id),
    "La búsqueda pública no devolvió la barbería.",
  );
  console.log("✓ search_shops");

  // La marca se escribe con guion, espacio o todo junto. La búsqueda no debe
  // depender de esos signos.
  const compactName = shop.name.replace(/[^a-zA-Z0-9]+/g, "");
  const { data: compactResults, error: compactError } = await anon.rpc(
    "search_shops",
    { p_query: compactName },
  );
  if (compactError) throw compactError;
  assert(
    (compactResults ?? []).some((row) => row.id === shop.id),
    "La búsqueda pública no ignora guiones ni espacios.",
  );
  console.log("✓ search_shops sin signos");

  const { data: publicShop, error: publicShopError } = await anon.rpc(
    "get_public_shop",
    { p_slug: shop.slug },
  );
  if (publicShopError) throw publicShopError;
  assert(publicShop?.id === shop.id, "get_public_shop devolvió otra barbería.");
  console.log("✓ get_public_shop");

  const slot = await findSlot({
    shopId: shop.id,
    serviceId: serviceRow.id,
    barberId: barber.id,
    timezone: shop.timezone,
  });
  console.log(`✓ get_availability (${slot.start_at})`);

  const { data: publicId, error: publicError } = await anon.rpc(
    "create_public_booking",
    {
      p_shop_id: shop.id,
      p_service_id: serviceRow.id,
      p_barber_id: slot.barber_id,
      p_start: slot.start_at,
      p_name: testName,
      p_phone: testPhone,
      p_email: null,
      p_hair_type: null,
      p_preferred_style: null,
      p_notes: "Reserva de smoke test",
    },
  );
  if (publicError) throw publicError;
  created.appointments.push(publicId);
  console.log("✓ create_public_booking");

  const { data: confirmation, error: confirmationError } = await anon.rpc(
    "get_booking_confirmation",
    { p_id: publicId },
  );
  if (confirmationError) throw confirmationError;
  assert(confirmation?.client?.name === testName, "Confirmación incorrecta.");
  assert(confirmation?.shop?.id === shop.id, "La confirmación muestra otra barbería.");
  assert(
    confirmation?.client?.has_email === false,
    "La reserva no debería tener correo todavía.",
  );
  // Ni el correo del cliente ni el teléfono del barbero deben viajar al
  // navegador. `has_email` es lo único que necesita la pantalla.
  assert(
    !("email" in (confirmation?.client ?? {})),
    "La confirmación expone el correo del cliente.",
  );
  assert(
    !("phone" in (confirmation?.barber ?? {})),
    "La confirmación expone el teléfono del barbero.",
  );
  console.log("✓ get_booking_confirmation");

  const { data: createdBooking } = await service
    .from("appointments")
    .select("client_id")
    .eq("id", publicId)
    .eq("shop_id", shop.id)
    .single();
  created.clientId = createdBooking?.client_id ?? null;

  const { error: emailError } = await anon.rpc("set_booking_email", {
    p_id: publicId,
    p_email: testEmail,
  });
  if (emailError) throw emailError;

  const { data: withEmail } = await anon.rpc("get_booking_confirmation", {
    p_id: publicId,
  });
  assert(
    withEmail?.client?.has_email === true,
    "set_booking_email no actualizó la confirmación.",
  );
  assert(
    !("email" in (withEmail?.client ?? {})),
    "La confirmación expone el correo después de guardarlo.",
  );
  console.log("✓ set_booking_email");

  const { data: auth, error: authError } = await anon.auth.signInWithPassword({
    email: "admin@ensilla.app",
    password: "admin123",
  });
  if (authError) throw authError;
  assert(auth.session, "No se pudo iniciar sesión como admin.");

  const admin = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${auth.session.access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sessionShop } = await admin.rpc("current_shop");
  assert(sessionShop?.id === shop.id, "current_shop no coincide con la demo.");

  // El privilegio de columna debe impedir cambiar el rol por la API, incluso
  // para un administrador: ese cambio solo lo hace la Edge Function.
  const escalate = await admin
    .from("profiles")
    .update({ role: "ADMIN" })
    .eq("id", auth.user.id);
  assert(escalate.error, "La escalada de privilegios no está bloqueada.");
  console.log("✓ update de role bloqueado");

  const { data: visibleServices, error: appointmentSelectError } = await admin
    .from("services")
    .select("id,shop_id");
  if (appointmentSelectError) throw appointmentSelectError;
  assert(
    (visibleServices ?? []).every((row) => row.shop_id === shop.id),
    "El panel ve servicios de otra barbería.",
  );
  console.log("✓ servicios acotados a la barbería");

  const { error: appointmentSelectRelError } = await admin
    .from("appointments")
    .select(
      `*,
       client:clients(*),
       barber:profiles!appointments_barber_id_fkey(*),
       service:services(*)`,
    )
    .limit(1);
  if (appointmentSelectRelError) throw appointmentSelectRelError;
  console.log("✓ appointments relational select");

  const { error: clientSelectError } = await admin
    .from("clients")
    .select(
      `*,
       preferred_barber:profiles!clients_preferred_barber_id_fkey(id,name,color),
       ideas:haircut_ideas(*,created_by:profiles!haircut_ideas_created_by_id_fkey(name)),
       appointments:appointments(*,
         client:clients(*),
         barber:profiles!appointments_barber_id_fkey(*),
         service:services(*)
       )`,
    )
    .limit(1);
  if (clientSelectError) throw clientSelectError;
  console.log("✓ clients relational select");

  // Aislamiento: se crea una barbería temporal con un servicio y se comprueba
  // que la sesión de la barbería demo no pueda verlo.
  const { data: tempShop, error: tempShopError } = await service
    .from("shops")
    .insert({
      slug: tempSlug,
      name: `Otra Barbería ${suffix}`,
      active: true,
    })
    .select("id")
    .single();
  if (tempShopError) throw tempShopError;
  created.tempShopId = tempShop.id;

  const { data: tempService, error: tempServiceError } = await service
    .from("services")
    .insert({
      shop_id: tempShop.id,
      name: `Servicio temporal ${suffix}`,
      duration_min: 30,
      price_cents: 1000000,
    })
    .select("id")
    .single();
  if (tempServiceError) throw tempServiceError;
  created.tempServiceId = tempService.id;

  const { data: leakedServices, error: leakError } = await admin
    .from("services")
    .select("id,shop_id");
  if (leakError) throw leakError;
  assert(
    (leakedServices ?? []).every((row) => row.shop_id !== tempShop.id),
    "La sesión ve servicios de otra barbería.",
  );
  console.log("✓ aislamiento entre barberías");

  const staffSlot = await findSlot({
    shopId: shop.id,
    serviceId: serviceRow.id,
    barberId: barber.id,
    timezone: shop.timezone,
  });
  const { data: existingClient, error: clientError } = await service
    .from("clients")
    .select("id")
    .eq("shop_id", shop.id)
    .limit(1)
    .single();
  if (clientError) throw clientError;

  const { data: staffId, error: staffError } = await admin.rpc(
    "create_staff_appointment",
    {
      p_client_id: existingClient.id,
      p_client_name: null,
      p_client_phone: null,
      p_client_email: null,
      p_barber_id: staffSlot.barber_id,
      p_service_id: serviceRow.id,
      p_start: staffSlot.start_at,
      p_status: "CONFIRMED",
      p_notes: "Turno de smoke test",
      p_source: "STAFF",
    },
  );
  if (staffError) throw staffError;
  created.appointments.push(staffId);
  console.log("✓ create_staff_appointment");

  const { data: edgeResult, error: edgeError } = await admin.functions.invoke(
    "admin-users",
    {
      body: {
        action: "create",
        name: testName,
        email: testEmail,
        password: `Test-${suffix}-123`,
        color: "#3f7d6c",
        role: "BARBER",
      },
    },
  );
  if (edgeError) throw new Error(`admin-users create: ${edgeError.message}`);
  assert(edgeResult?.id, "admin-users no devolvió el usuario.");
  created.userId = edgeResult.id;

  const { data: newProfile } = await service
    .from("profiles")
    .select("shop_id,role")
    .eq("id", created.userId)
    .single();
  assert(
    newProfile?.shop_id === shop.id && newProfile?.role === "BARBER",
    "La cuenta creada quedó en otra barbería o con otro rol.",
  );
  console.log("✓ admin-users create acotado por barbería");

  const { data: edgeUpdate, error: edgeUpdateError } =
    await admin.functions.invoke("admin-users", {
      body: {
        action: "update",
        id: created.userId,
        name: `${testName} Editado`,
        email: testEmail,
        color: "#c2703d",
        role: "BARBER",
        active: false,
      },
    });
  if (edgeUpdateError) {
    throw new Error(`admin-users update: ${edgeUpdateError.message}`);
  }
  assert(edgeUpdate?.id === created.userId, "admin-users update falló.");
  console.log("✓ admin-users update");

  const { data: edgeToggle, error: edgeToggleError } =
    await admin.functions.invoke("admin-users", {
      body: { action: "toggle", id: created.userId, active: true },
    });
  if (edgeToggleError) {
    throw new Error(`admin-users toggle: ${edgeToggleError.message}`);
  }
  assert(
    edgeToggle?.id === created.userId && edgeToggle.active === true,
    "admin-users toggle falló.",
  );
  console.log("✓ admin-users toggle");

  if (process.env.SMOKE_SEND_REMINDER === "true") {
    // Solo se ejecuta a pedido: envía un correo real con Resend. El correo de
    // prueba usa el dominio reservado `.test`.
    const { error: reminderError } = await anon.functions.invoke(
      "send-reminder",
      { body: { appointmentId: publicId } },
    );
    if (reminderError) {
      throw new Error(`send-reminder: ${reminderError.message}`);
    }
    const { data: reminded } = await service
      .from("appointments")
      .select("reminder_sent_at")
      .eq("id", publicId)
      .single();
    assert(reminded?.reminder_sent_at, "send-reminder no marcó el envío.");
    console.log("✓ send-reminder");
  } else {
    console.log("· send-reminder omitido (SMOKE_SEND_REMINDER != true)");
  }

  console.log("\nSmoke test completado.");
} finally {
  if (created.appointments.length) {
    await service.from("appointments").delete().in("id", created.appointments);
  }
  if (created.clientId) {
    await service.from("clients").delete().eq("id", created.clientId);
  }
  if (created.tempServiceId) {
    await service.from("services").delete().eq("id", created.tempServiceId);
  }
  if (created.tempShopId) {
    await service.from("shops").delete().eq("id", created.tempShopId);
  }
  if (created.userId) {
    await service.from("profiles").delete().eq("id", created.userId);
    await service.auth.admin.deleteUser(created.userId);
  }
  await service
    .from("notifications")
    .delete()
    .gte("created_at", startedAt)
    .like("body", `%${testName}%`);
  await anon.auth.signOut();
}
