import { createClient } from "@supabase/supabase-js";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const TZ = "America/Argentina/Buenos_Aires";

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261027);
const pick = (items) => items[Math.floor(rng() * items.length)];

function localInstant(dayOffsetFromToday, minutes) {
  const nowZoned = toZonedTime(new Date(), TZ);
  const base = startOfDay(addDays(nowZoned, dayOffsetFromToday));
  const withTime = setMinutes(setHours(base, Math.floor(minutes / 60)), minutes % 60);
  return fromZonedTime(withTime, TZ);
}

function localTime(dayOffsetFromToday, hour, minute = 0) {
  return localInstant(dayOffsetFromToday, hour * 60 + minute);
}

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function ensureUser(email, password, name) {
  const list = await must(supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }), "listUsers");
  const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (existing) {
    const updated = await must(
      supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { name },
      }),
      `updateUser ${email}`,
    );
    return updated.user;
  }
  const created = await must(
    supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    }),
    `createUser ${email}`,
  );
  return created.user;
}

async function main() {
  console.log("Creando usuarios demo...");
  const admin = await ensureUser("admin@ensilla.app", "admin123", "Mateo Fernández");
  const brunoUser = await ensureUser("bruno@ensilla.app", "barber123", "Bruno Acosta");
  const valentinaUser = await ensureUser("valentina@ensilla.app", "barber123", "Valentina Ríos");

  console.log("Limpiando datos anteriores...");
  await must(supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "notifications");
  await must(supabase.from("haircut_ideas").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "haircut_ideas");
  await must(supabase.from("appointments").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "appointments");
  await must(supabase.from("time_off").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "time_off");
  await must(supabase.from("clients").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "clients");
  await must(supabase.from("services").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "services");
  await must(supabase.from("business_hours").delete().neq("weekday", -1), "business_hours");

  console.log("Configuración de la barbería...");
  await must(
    supabase.from("shop_setting").upsert({
      id: 1,
      name: "En-silla Barbershop",
      tagline: "Cortes con memoria",
      description:
        "Una barbería de barrio que se toma el tiempo de conocerte. Agenda simple, atención cuidada y un corte pensado para vos.",
      address: "Av. Córdoba 3421, Palermo",
      phone: "+54 11 5555-0100",
      whatsapp: "5491155550100",
      email: "hola@ensilla.app",
      instagram: "ensilla.barbershop",
      currency: "ARS",
      timezone: TZ,
      slot_step_min: 15,
      buffer_min: 10,
      lead_time_min: 60,
      booking_window_days: 21,
    }),
    "shop_setting",
  );

  await must(
    supabase.from("business_hours").insert([
      { weekday: 0, open_minute: 0, close_minute: 0, active: false },
      { weekday: 1, open_minute: 0, close_minute: 0, active: false },
      { weekday: 2, open_minute: 600, close_minute: 1200, active: true },
      { weekday: 3, open_minute: 600, close_minute: 1200, active: true },
      { weekday: 4, open_minute: 600, close_minute: 1200, active: true },
      { weekday: 5, open_minute: 600, close_minute: 1200, active: true },
      { weekday: 6, open_minute: 540, close_minute: 1080, active: true },
    ]),
    "business_hours",
  );

  const profiles = [
    { id: admin.id, name: "Mateo Fernández", role: "ADMIN", phone: "+54 11 5555-0101", bio: "Fundador de En-silla. Especialista en clásicos y fades limpios.", color: "#c2703d", active: true },
    { id: brunoUser.id, name: "Bruno Acosta", role: "BARBER", phone: "+54 11 5555-0102", bio: "Texturas, rizos y degradados con personalidad.", color: "#3f7d6c", active: true },
    { id: valentinaUser.id, name: "Valentina Ríos", role: "BARBER", phone: "+54 11 5555-0103", bio: "Cortes con movimiento, color y asesoramiento de imagen.", color: "#7c5cbf", active: true },
  ];
  for (const profile of profiles) {
    await must(supabase.from("profiles").update(profile).eq("id", profile.id), `profile ${profile.name}`);
  }

  const serviceRows = [
    { name: "Corte clásico", description: "Tijera y máquina, lavado y peinado final.", duration_min: 45, price_cents: 1200000, sort_order: 1 },
    { name: "Fade / degradado", description: "Degradado a navaja con definición de contornos.", duration_min: 60, price_cents: 1500000, sort_order: 2 },
    { name: "Corte + barba", description: "El combo completo: corte a medida y barba perfilada.", duration_min: 75, price_cents: 2000000, sort_order: 3 },
    { name: "Arreglo de barba", description: "Perfilado, navaja y aceites para dejar la barba impecable.", duration_min: 30, price_cents: 800000, sort_order: 4 },
    { name: "Corte niño", description: "Corte cómodo y rápido, con paciencia de sobra.", duration_min: 30, price_cents: 900000, sort_order: 5 },
    { name: "Afeitado a navaja", description: "Ritual completo con toalla caliente y bálsamo.", duration_min: 40, price_cents: 1100000, sort_order: 6 },
  ];
  const services = [];
  for (const row of serviceRows) {
    const data = await must(supabase.from("services").insert(row).select("*").single(), `service ${row.name}`);
    services.push(data);
  }

  const clientsData = [
    {
      name: "Tomás Aguirre",
      phone: "11 4412-7788",
      email: "tomas.aguirre@mail.com",
      hairType: "Ondulado medio",
      preferredStyle: "Fade bajo con textura arriba",
      products: "Pomada mate",
      allergies: "Sin alergias conocidas",
      preferredBarberId: brunoUser.id,
      notes: "Le gusta charlar de fútbol. Prefiere turnos después de las 18.",
      ideas: [
        { title: "Textura despeinada con fade bajo", description: "Mantener el fade bajo y trabajar la parte de arriba con textura hacia adelante. Queda bien con pomada mate y secado suave.", tags: "fade, textura, ondulado" },
        { title: "Contornos más limpios", description: "Refrescar la línea del cuello y las patillas cada tres semanas para que el degradado no pierda forma.", tags: "mantenimiento, contornos" },
      ],
    },
    {
      name: "Julián Sosa",
      phone: "11 5039-2210",
      email: "julian.sosa@mail.com",
      hairType: "Lacio grueso",
      preferredStyle: "Clásico con raya al costado",
      products: "Cera de brillo",
      allergies: "Piel sensible en la nuca",
      preferredBarberId: admin.id,
      notes: "Viene siempre con su hijo. Evitar productos con alcohol.",
      ideas: [
        { title: "Raya marcada y volumen controlado", description: "Peinar con raya al costado y secador para sostener el volumen. Cera de brillo solo en las puntas.", tags: "clásico, raya" },
      ],
    },
    {
      name: "Martina López",
      phone: "11 6788-1042",
      email: "martina.lopez@mail.com",
      hairType: "Liso fino",
      preferredStyle: "Bob con capas largas",
      products: "Texturizador en spray",
      allergies: "Ninguna",
      preferredBarberId: valentinaUser.id,
      notes: "Le gusta el corte versátil para llevar atado o suelto.",
      ideas: [
        { title: "Bob con capas invisibles", description: "Capas largas que dan movimiento sin quitar peso. Ideal para su cabello fino: más aire y menos rigidez.", tags: "bob, capas, liso" },
        { title: "Flequillo cortina", description: "Probar un flequillo cortina liviano para enmarcar el rostro, fácil de llevar hacia los costados.", tags: "flequillo, tendencia" },
      ],
    },
    {
      name: "Ramiro Díaz",
      phone: "11 3321-9098",
      email: "ramiro.diaz@mail.com",
      hairType: "Crespo",
      preferredStyle: "Degradado alto con línea",
      products: "Crema para rizos",
      allergies: "Ninguna",
      preferredBarberId: brunoUser.id,
      notes: "Le encanta el diseño de líneas. Sacar fotos del resultado.",
      ideas: [
        { title: "Taper fade con línea geométrica", description: "Subir el degradado en las sienes y sumar una línea discreta del lado. La parte superior se define con crema.", tags: "fade, línea, crespo" },
        { title: "Rizos definidos con leave-in", description: "Aplicar leave-in con cabello húmedo y difusor a temperatura baja para mantener el volumen natural.", tags: "rizos, cuidado" },
      ],
    },
    {
      name: "Sofía Benítez",
      phone: "11 4455-6712",
      email: "sofia.benitez@mail.com",
      hairType: "Ondulado fino",
      preferredStyle: "Long bob con flequillo",
      products: "Spray salino",
      allergies: "Ninguna",
      preferredBarberId: valentinaUser.id,
      notes: "Prefiere turnos de mañana. Muy fan del spray salino.",
      ideas: [
        { title: "Long bob con flequillo abierto", description: "Un long bob a la mandíbula con flequillo abierto aporta frescura sin perder largo. Textura con spray salino.", tags: "long bob, flequillo" },
      ],
    },
    {
      name: "Nicolás Ferreyra",
      phone: "11 5512-3344",
      email: "nico.ferreyra@mail.com",
      hairType: "Lacio",
      preferredStyle: "Buzz cut con fade",
      products: "Gel mate",
      allergies: "Ninguna",
      preferredBarberId: admin.id,
      notes: "Corte rápido, siempre puntual. Prefiere sin secado.",
      ideas: [
        { title: "Buzz cut con fade en los laterales", description: "Mantener el largo arriba y sumar un fade limpio en los costados para un look prolijo de bajo mantenimiento.", tags: "buzz, fade, minimalista" },
      ],
    },
    {
      name: "Camila Ruiz",
      phone: "11 6098-2277",
      email: "camila.ruiz@mail.com",
      hairType: "Rizado",
      preferredStyle: "Curly shag",
      products: "Leave-in sin sulfatos",
      allergies: "Ninguna",
      preferredBarberId: valentinaUser.id,
      notes: "Le gusta probar cortes con personalidad. Trae referencias en el celular.",
      ideas: [
        { title: "Curly shag en capas", description: "Capas medianas que abrazan la forma del rizo y liberan volumen. Secar al aire con leave-in.", tags: "shag, rizado, capas" },
        { title: "Mantenimiento de puntas", description: "Recortar puntas cada 8 semanas para que el rizo se mantenga definido y sin frizz.", tags: "mantenimiento, rizos" },
      ],
    },
    {
      name: "Facundo Molina",
      phone: "11 4477-1166",
      email: "facu.molina@mail.com",
      hairType: "Lacio grueso",
      preferredStyle: "Pompadour moderno",
      products: "Pomada clásica",
      allergies: "Cuero cabelludo seco",
      preferredBarberId: brunoUser.id,
      notes: "Trabaja cerca, suele pasar sin turno. Recordarle hidratación.",
      ideas: [
        { title: "Pompadour con laterales cortos", description: "Volumen arriba peinado hacia atrás y laterales más cortos. Fijar con pomada clásica y peine.", tags: "pompadour, clásico" },
        { title: "Tratamiento de hidratación", description: "Sumar una mascarilla suave al lavado para controlar la sequedad del cuero cabelludo.", tags: "cuidado, hidratación" },
      ],
    },
    {
      name: "Agustina Vega",
      phone: "11 5123-8899",
      email: "agustina.vega@mail.com",
      hairType: "Ondulado",
      preferredStyle: "Capas largas con movimiento",
      products: "Aceite ligero",
      allergies: "Ninguna",
      preferredBarberId: valentinaUser.id,
      notes: "Le gusta el pelo largo. Solo despuntar y dar forma.",
      ideas: [
        { title: "Capas largas que enmarcan", description: "Capas desde el mentón hacia abajo para dar movimiento sin acortar demasiado. Terminar con aceite ligero.", tags: "capas, largo, ondulado" },
      ],
    },
    {
      name: "Bruno Salas",
      phone: "11 3344-7788",
      email: "bruno.salas@mail.com",
      hairType: "Afro",
      preferredStyle: "Taper fade",
      products: "Crema definidora",
      allergies: "Ninguna",
      preferredBarberId: admin.id,
      notes: "Le gusta el volumen natural. No usar máquina arriba.",
      ideas: [
        { title: "Taper fade respetando el volumen", description: "Degradar solo sienes y nuca, dejando la parte superior con volumen natural y forma redondeada.", tags: "afro, taper, volumen" },
      ],
    },
    {
      name: "Santiago Ponce",
      phone: "11 6677-4455",
      email: "santi.ponce@mail.com",
      hairType: "Lacio fino",
      preferredStyle: "Mullet moderno",
      products: "Texturizador",
      allergies: "Ninguna",
      preferredBarberId: brunoUser.id,
      notes: "Sigue la tendencia. Le gusta experimentar con la nuca.",
      ideas: [
        { title: "Mullet suavizado", description: "Mantener la nuca con textura y laterales más limpios. Texturizador para dar movimiento sin apelmazar.", tags: "mullet, tendencia, textura" },
      ],
    },
    {
      name: "Valentín Correa",
      phone: "11 5599-0011",
      email: "valen.correa@mail.com",
      hairType: "Crespo",
      preferredStyle: "Corte con diseño",
      products: "Pomada",
      allergies: "Ninguna",
      preferredBarberId: admin.id,
      notes: "Menor de edad: viene con su mamá. Diseño simple.",
      ideas: [
        { title: "Diseño lateral discreto", description: "Un diseño simple en un costado y degradado medio, fácil de mantener para el colegio.", tags: "diseño, fade, joven" },
      ],
    },
  ];

  const clients = [];
  for (const data of clientsData) {
    const { ideas, ...clientData } = data;
    const row = await must(
      supabase
        .from("clients")
        .insert({
          name: clientData.name,
          phone: clientData.phone.replace(/\D/g, ""),
          email: clientData.email,
          hair_type: clientData.hairType,
          preferred_style: clientData.preferredStyle,
          products: clientData.products,
          allergies: clientData.allergies,
          preferred_barber_id: clientData.preferredBarberId,
          notes: clientData.notes,
          created_at: localInstant(-Math.floor(rng() * 180), 600).toISOString(),
        })
        .select("*")
        .single(),
      `client ${clientData.name}`,
    );
    clients.push(row);
    if (ideas.length > 0) {
      await must(
        supabase.from("haircut_ideas").insert(
          ideas.map((idea) => ({
            ...idea,
            client_id: row.id,
            created_by_id: clientData.preferredBarberId ?? admin.id,
          })),
        ),
        `ideas ${clientData.name}`,
      );
    }
  }
  console.log(`Clientes creados: ${clients.length}`);

  await must(
    supabase.from("time_off").insert({
      user_id: valentinaUser.id,
      start_at: localTime(4, 10, 0).toISOString(),
      end_at: localTime(4, 14, 0).toISOString(),
      reason: "Curso de coloración",
    }),
    "time_off",
  );

  const barbers = profiles;
  const statusPool = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "CANCELLED", "NO_SHOW"];
  const appointments = [];
  const now = new Date();

  for (let dayOffset = -56; dayOffset <= 10; dayOffset++) {
    const dayStart = localInstant(dayOffset, 0);
    const weekday = Number(formatInTimeZone(dayStart, TZ, "i")) % 7;
    const hours = [
      { weekday: 2, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 3, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 4, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 5, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 6, openMinute: 540, closeMinute: 1080, active: true },
    ].find((h) => h.weekday === weekday);
    if (!hours) continue;

    for (const barber of barbers) {
      let cursor = hours.openMinute;
      const preferred = clients.filter((c) => c.preferred_barber_id === barber.id);
      while (cursor < hours.closeMinute - 30) {
        if (rng() < 0.22) {
          cursor += 30;
          continue;
        }
        const service = pick(services);
        if (cursor + service.duration_min > hours.closeMinute) break;

        const client = rng() < 0.55 ? pick(preferred.length > 0 ? preferred : clients) : pick(clients);
        const start = localInstant(dayOffset, cursor);
        const end = new Date(start.getTime() + service.duration_min * 60_000);
        let status;
        if (end < now) {
          status = pick(statusPool);
        } else if (dayOffset === 0) {
          status = rng() < 0.35 ? "PENDING" : "CONFIRMED";
        } else {
          status = rng() < 0.25 ? "PENDING" : "CONFIRMED";
          if (rng() < 0.08) status = "CANCELLED";
        }
        appointments.push({
          client_id: client.id,
          barber_id: barber.id,
          service_id: service.id,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          status,
          price_cents: service.price_cents,
          source: rng() < 0.75 ? "STAFF" : "PUBLIC",
          notes:
            rng() < 0.12
              ? pick([
                  "Cliente pidió máquina 1 en los costados.",
                  "Trajo referencia para el flequillo.",
                  "Prefiere no usar secador.",
                  "Sumar perfilado de barba si hay tiempo.",
                ])
              : null,
        });
        cursor += service.duration_min + 10 + (rng() < 0.35 ? 15 : 0);
      }
    }
  }

  console.log(`Creando ${appointments.length} turnos...`);
  for (let i = 0; i < appointments.length; i += 200) {
    await must(supabase.from("appointments").insert(appointments.slice(i, i + 200)), `appointments ${i}`);
  }

  const upcoming = appointments.filter((a) => new Date(a.start_at) > now && a.status === "CONFIRMED").slice(0, 6);
  const notifications = [
    {
      user_id: admin.id,
      title: "Bienvenido a En-silla",
      body: "Este es tu panel de operación diaria. Desde acá podés ver la agenda, la caja del día y las preferencias de cada cliente.",
      href: "/panel",
      read_at: null,
    },
    ...barbers.map((barber) => ({
      user_id: barber.id,
      title: "Agenda del día lista",
      body: "Revisá tus turnos de hoy y los clientes que vuelven. Sus preferencias están guardadas en cada ficha.",
      href: "/panel/agenda",
      read_at: null,
    })),
    ...upcoming.map((a) => ({
      user_id: a.barber_id,
      title: "Nuevo turno confirmado",
      body: `${clients.find((c) => c.id === a.client_id)?.name ?? "Cliente"} reservó para el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(new Date(a.start_at))}.`,
      href: "/panel/agenda",
      read_at: rng() < 0.4 ? new Date().toISOString() : null,
    })),
  ];
  await must(supabase.from("notifications").insert(notifications), "notifications");

  console.log("Listo.");
  console.log("Admin:   admin@ensilla.app / admin123");
  console.log("Barberos: bruno@ensilla.app / barber123");
  console.log("          valentina@ensilla.app / barber123");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
