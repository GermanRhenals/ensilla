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
const created = { appointments: [], clientId: null, userId: null };
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

async function findSlot({ serviceId, barberId, timezone }) {
  for (let offset = 1; offset <= 21; offset += 1) {
    const day = dateKey(addDays(new Date(), offset), timezone);
    const { data, error } = await anon.rpc("get_availability", {
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
  const [
    { data: shop, error: shopError },
    { data: services, error: serviceError },
    { data: barbers, error: barberError },
  ] = await Promise.all([
    service.from("shop_setting").select("*").eq("id", 1).single(),
    service.from("services").select("*").eq("active", true).limit(1),
    service.from("profiles").select("id,name").eq("active", true).limit(1),
  ]);
  if (shopError) throw shopError;
  if (serviceError) throw serviceError;
  if (barberError) throw barberError;

  const serviceRow = services?.[0];
  const barber = barbers?.[0];
  assert(serviceRow && barber, "Faltan datos base para la prueba.");

  const slot = await findSlot({
    serviceId: serviceRow.id,
    barberId: barber.id,
    timezone: shop.timezone,
  });
  console.log(`✓ get_availability (${slot.start_at})`);

  const { data: publicId, error: publicError } = await anon.rpc(
    "create_public_booking",
    {
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
  console.log("✓ get_booking_confirmation");

  const { data: createdBooking } = await service
    .from("appointments")
    .select("client_id")
    .eq("id", publicId)
    .single();
  created.clientId = createdBooking?.client_id ?? null;

  const { data: auth, error: authError } =
    await anon.auth.signInWithPassword({
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

  const { error: appointmentSelectError } = await admin
    .from("appointments")
    .select(
      `*,
       client:clients(*),
       barber:profiles!appointments_barber_id_fkey(*),
       service:services(*)`,
    )
    .limit(1);
  if (appointmentSelectError) throw appointmentSelectError;
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

  const { error: publicBarberError } = await anon
    .from("barbers_public")
    .select("*");
  if (publicBarberError) throw publicBarberError;
  console.log("✓ barbers_public select");

  const staffSlot = await findSlot({
    serviceId: serviceRow.id,
    barberId: barber.id,
    timezone: shop.timezone,
  });
  const { data: existingClient, error: clientError } = await service
    .from("clients")
    .select("id")
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
  console.log("✓ admin-users create");

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
} finally {
  if (created.appointments.length) {
    await service
      .from("appointments")
      .delete()
      .in("id", created.appointments);
  }
  if (created.clientId) {
    await service.from("clients").delete().eq("id", created.clientId);
  }
  if (created.userId) {
    await service.auth.admin.deleteUser(created.userId);
  }
  await service
    .from("notifications")
    .delete()
    .gte("created_at", startedAt)
    .like("body", `%${testName}%`);
  await anon.auth.signOut();
}
