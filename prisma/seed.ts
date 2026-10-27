import { PrismaClient, type Client } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();
const TZ = process.env.SHOP_TIMEZONE ?? "America/Bogota";
const SHOP_CURRENCY = process.env.SHOP_CURRENCY ?? "COP";
const SHOP_LOCALE = process.env.SHOP_LOCALE ?? "es-CO";
const SHOP_WHATSAPP_COUNTRY_CODE =
  process.env.SHOP_WHATSAPP_COUNTRY_CODE ?? "57";

function mulberry32(seed: number) {
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

function pick<T>(items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function localInstant(dayOffsetFromToday: number, minutes: number) {
  const nowZoned = toZonedTime(new Date(), TZ);
  const base = startOfDay(addDays(nowZoned, dayOffsetFromToday));
  const withTime = setMinutes(setHours(base, Math.floor(minutes / 60)), minutes % 60);
  return fromZonedTime(withTime, TZ);
}

function localTime(dayOffsetFromToday: number, hour: number, minute = 0) {
  return localInstant(dayOffsetFromToday, hour * 60 + minute);
}

async function main() {
  console.log("Limpiando datos anteriores...");
  await prisma.notification.deleteMany();
  await prisma.haircutIdea.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.user.deleteMany();
  await prisma.shopSetting.deleteMany();

  console.log("Configuración de la barbería...");
  await prisma.shopSetting.create({
    data: {
      id: 1,
      name: "En-silla Barbershop",
      tagline: "Cortes con memoria",
      description:
        "Una barbería de barrio que se toma el tiempo de conocerte. Agenda simple, atención cuidada y un corte pensado para vos.",
      address: "Cra. 11 #85-42, Bogotá",
      phone: "+57 320 555 0100",
      whatsapp: "573205550100",
      email: "hola@ensilla.app",
      instagram: "ensilla.barbershop",
      currency: SHOP_CURRENCY,
      timezone: TZ,
      locale: SHOP_LOCALE,
      whatsappCountryCode: SHOP_WHATSAPP_COUNTRY_CODE,
      slotStepMin: 15,
      bufferMin: 10,
      leadTimeMin: 60,
      bookingWindowDays: 21,
    },
  });

  await prisma.businessHour.createMany({
    data: [
      { weekday: 0, openMinute: 0, closeMinute: 0, active: false },
      { weekday: 1, openMinute: 0, closeMinute: 0, active: false },
      { weekday: 2, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 3, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 4, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 5, openMinute: 600, closeMinute: 1200, active: true },
      { weekday: 6, openMinute: 540, closeMinute: 1080, active: true },
    ],
  });

  const password = await bcrypt.hash("barber123", 10);
  const adminPassword = await bcrypt.hash("admin123", 10);

  const [mati, bruno, valentina] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Mateo Restrepo",
        email: "admin@ensilla.app",
        passwordHash: adminPassword,
        role: "ADMIN",
        phone: "+57 320 555 0101",
        bio: "Fundador de En-silla. Especialista en clásicos y fades limpios.",
        color: "#c2703d",
      },
    }),
    prisma.user.create({
      data: {
        name: "Bruno Salazar",
        email: "bruno@ensilla.app",
        passwordHash: password,
        role: "BARBER",
        phone: "+57 320 555 0102",
        bio: "Texturas, rizos y degradados con personalidad.",
        color: "#3f7d6c",
      },
    }),
    prisma.user.create({
      data: {
        name: "Valentina Ospina",
        email: "valentina@ensilla.app",
        passwordHash: password,
        role: "BARBER",
        phone: "+57 320 555 0103",
        bio: "Cortes con movimiento, color y asesoramiento de imagen.",
        color: "#7c5cbf",
      },
    }),
  ]);

  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: "Corte clásico",
        description: "Tijera y máquina, lavado y peinado final.",
        durationMin: 45,
        priceCents: 3500000,
        sortOrder: 1,
      },
    }),
    prisma.service.create({
      data: {
        name: "Fade / degradado",
        description: "Degradado a navaja con definición de contornos.",
        durationMin: 60,
        priceCents: 4000000,
        sortOrder: 2,
      },
    }),
    prisma.service.create({
      data: {
        name: "Corte + barba",
        description: "El combo completo: corte a medida y barba perfilada.",
        durationMin: 75,
        priceCents: 5500000,
        sortOrder: 3,
      },
    }),
    prisma.service.create({
      data: {
        name: "Arreglo de barba",
        description: "Perfilado, navaja y aceites para dejar la barba impecable.",
        durationMin: 30,
        priceCents: 2500000,
        sortOrder: 4,
      },
    }),
    prisma.service.create({
      data: {
        name: "Corte niño",
        description: "Corte cómodo y rápido, con paciencia de sobra.",
        durationMin: 30,
        priceCents: 3000000,
        sortOrder: 5,
      },
    }),
    prisma.service.create({
      data: {
        name: "Afeitado a navaja",
        description: "Ritual completo con toalla caliente y bálsamo.",
        durationMin: 40,
        priceCents: 3000000,
        sortOrder: 6,
      },
    }),
  ]);

  const clientsData = [
    {
      name: "Andrés Mejía",
      phone: "300 555 0101",
      email: "andres.mejia@mail.com",
      hairType: "Ondulado medio",
      preferredStyle: "Fade bajo con textura arriba",
      products: "Pomada mate",
      allergies: "Sin alergias conocidas",
      preferredBarberId: bruno.id,
      notes: "Le gusta charlar de fútbol. Prefiere turnos después de las 18.",
      ideas: [
        {
          title: "Textura despeinada con fade bajo",
          description:
            "Mantener el fade bajo y trabajar la parte de arriba con textura hacia adelante. Queda bien con pomada mate y secado suave.",
          tags: "fade, textura, ondulado",
        },
        {
          title: "Contornos más limpios",
          description:
            "Refrescar la línea del cuello y las patillas cada tres semanas para que el degradado no pierda forma.",
          tags: "mantenimiento, contornos",
        },
      ],
    },
    {
      name: "Julián Cárdenas",
      phone: "301 555 0102",
      email: "julian.cardenas@mail.com",
      hairType: "Lacio grueso",
      preferredStyle: "Clásico con raya al costado",
      products: "Cera de brillo",
      allergies: "Piel sensible en la nuca",
      preferredBarberId: mati.id,
      notes: "Viene siempre con su hijo. Evitar productos con alcohol.",
      ideas: [
        {
          title: "Raya marcada y volumen controlado",
          description:
            "Peinar con raya al costado y secador para sostener el volumen. Cera de brillo solo en las puntas.",
          tags: "clásico, raya",
        },
      ],
    },
    {
      name: "Mariana López",
      phone: "302 555 0103",
      email: "mariana.lopez@mail.com",
      hairType: "Liso fino",
      preferredStyle: "Bob con capas largas",
      products: "Texturizador en spray",
      allergies: "Ninguna",
      preferredBarberId: valentina.id,
      notes: "Le gusta el corte versátil para llevar atado o suelto.",
      ideas: [
        {
          title: "Bob con capas invisibles",
          description:
            "Capas largas que dan movimiento sin quitar peso. Ideal para su cabello fino: más aire y menos rigidez.",
          tags: "bob, capas, liso",
        },
        {
          title: "Flequillo cortina",
          description:
            "Probar un flequillo cortina liviano para enmarcar el rostro, fácil de llevar hacia los costados.",
          tags: "flequillo, tendencia",
        },
      ],
    },
    {
      name: "Ramiro Quintero",
      phone: "303 555 0104",
      email: "ramiro.quintero@mail.com",
      hairType: "Crespo",
      preferredStyle: "Degradado alto con línea",
      products: "Crema para rizos",
      allergies: "Ninguna",
      preferredBarberId: bruno.id,
      notes: "Le encanta el diseño de líneas. Sacar fotos del resultado.",
      ideas: [
        {
          title: "Taper fade con línea geométrica",
          description:
            "Subir el degradado en las sienes y sumar una línea discreta del lado. La parte superior se define con crema.",
          tags: "fade, línea, crespo",
        },
        {
          title: "Rizos definidos con leave-in",
          description:
            "Aplicar leave-in con cabello húmedo y difusor a temperatura baja para mantener el volumen natural.",
          tags: "rizos, cuidado",
        },
      ],
    },
    {
      name: "Sofía Arango",
      phone: "304 555 0105",
      email: "sofia.arango@mail.com",
      hairType: "Ondulado fino",
      preferredStyle: "Long bob con flequillo",
      products: "Spray salino",
      allergies: "Ninguna",
      preferredBarberId: valentina.id,
      notes: "Prefiere turnos de mañana. Muy fan del spray salino.",
      ideas: [
        {
          title: "Long bob con flequillo abierto",
          description:
            "Un long bob a la mandíbula con flequillo abierto aporta frescura sin perder largo. Textura con spray salino.",
          tags: "long bob, flequillo",
        },
      ],
    },
    {
      name: "Nicolás Vélez",
      phone: "305 555 0106",
      email: "nicolas.velez@mail.com",
      hairType: "Lacio",
      preferredStyle: "Buzz cut con fade",
      products: "Gel mate",
      allergies: "Ninguna",
      preferredBarberId: mati.id,
      notes: "Corte rápido, siempre puntual. Prefiere sin secado.",
      ideas: [
        {
          title: "Buzz cut con fade en los laterales",
          description:
            "Mantener el largo arriba y sumar un fade limpio en los costados para un look prolijo de bajo mantenimiento.",
          tags: "buzz, fade, minimalista",
        },
      ],
    },
    {
      name: "Camila Torres",
      phone: "306 555 0107",
      email: "camila.torres@mail.com",
      hairType: "Rizado",
      preferredStyle: "Curly shag",
      products: "Leave-in sin sulfatos",
      allergies: "Ninguna",
      preferredBarberId: valentina.id,
      notes: "Le gusta probar cortes con personalidad. Trae referencias en el celular.",
      ideas: [
        {
          title: "Curly shag en capas",
          description:
            "Capas medianas que abrazan la forma del rizo y liberan volumen. Secar al aire con leave-in.",
          tags: "shag, rizado, capas",
        },
        {
          title: "Mantenimiento de puntas",
          description:
            "Recortar puntas cada 8 semanas para que el rizo se mantenga definido y sin frizz.",
          tags: "mantenimiento, rizos",
        },
      ],
    },
    {
      name: "Felipe Molina",
      phone: "307 555 0108",
      email: "felipe.molina@mail.com",
      hairType: "Lacio grueso",
      preferredStyle: "Pompadour moderno",
      products: "Pomada clásica",
      allergies: "Cuero cabelludo seco",
      preferredBarberId: bruno.id,
      notes: "Trabaja cerca, suele pasar sin turno. Recordarle hidratación.",
      ideas: [
        {
          title: "Pompadour con laterales cortos",
          description:
            "Volumen arriba peinado hacia atrás y laterales más cortos. Fijar con pomada clásica y peine.",
          tags: "pompadour, clásico",
        },
        {
          title: "Tratamiento de hidratación",
          description:
            "Sumar una mascarilla suave al lavado para controlar la sequedad del cuero cabelludo.",
          tags: "cuidado, hidratación",
        },
      ],
    },
    {
      name: "Daniela Vega",
      phone: "308 555 0109",
      email: "daniela.vega@mail.com",
      hairType: "Ondulado",
      preferredStyle: "Capas largas con movimiento",
      products: "Aceite ligero",
      allergies: "Ninguna",
      preferredBarberId: valentina.id,
      notes: "Le gusta el pelo largo. Solo despuntar y dar forma.",
      ideas: [
        {
          title: "Capas largas que enmarcan",
          description:
            "Capas desde el mentón hacia abajo para dar movimiento sin acortar demasiado. Terminar con aceite ligero.",
          tags: "capas, largo, ondulado",
        },
      ],
    },
    {
      name: "Sebastián Salas",
      phone: "309 555 0110",
      email: "sebastian.salas@mail.com",
      hairType: "Afro",
      preferredStyle: "Taper fade",
      products: "Crema definidora",
      allergies: "Ninguna",
      preferredBarberId: mati.id,
      notes: "Le gusta el volumen natural. No usar máquina arriba.",
      ideas: [
        {
          title: "Taper fade respetando el volumen",
          description:
            "Degradar solo sienes y nuca, dejando la parte superior con volumen natural y forma redondeada.",
          tags: "afro, taper, volumen",
        },
      ],
    },
    {
      name: "Santiago Ponce",
      phone: "310 555 0111",
      email: "santiago.ponce@mail.com",
      hairType: "Lacio fino",
      preferredStyle: "Mullet moderno",
      products: "Texturizador",
      allergies: "Ninguna",
      preferredBarberId: bruno.id,
      notes: "Sigue la tendencia. Le gusta experimentar con la nuca.",
      ideas: [
        {
          title: "Mullet suavizado",
          description:
            "Mantener la nuca con textura y laterales más limpios. Texturizador para dar movimiento sin apelmazar.",
          tags: "mullet, tendencia, textura",
        },
      ],
    },
    {
      name: "Valeria Correa",
      phone: "311 555 0112",
      email: "valeria.correa@mail.com",
      hairType: "Crespo",
      preferredStyle: "Corte con diseño",
      products: "Pomada",
      allergies: "Ninguna",
      preferredBarberId: mati.id,
      notes: "Menor de edad: viene con su mamá. Diseño simple.",
      ideas: [
        {
          title: "Diseño lateral discreto",
          description:
            "Un diseño simple en un costado y degradado medio, fácil de mantener para el colegio.",
          tags: "diseño, fade, joven",
        },
      ],
    },
  ];

  const clients: Client[] = [];
  for (const data of clientsData) {
    const { ideas, ...clientData } = data;
    const client = await prisma.client.create({
      data: {
        ...clientData,
        phone: clientData.phone.replace(/\D/g, ""),
        createdAt: localInstant(-Math.floor(rng() * 180), 600),
      },
    });
    clients.push(client);
    if (ideas.length > 0) {
      await prisma.haircutIdea.createMany({
        data: ideas.map((idea) => ({
          ...idea,
          clientId: client.id,
          createdById: data.preferredBarberId ?? mati.id,
        })),
      });
    }
  }

  console.log(`Clientes creados: ${clients.length}`);

  await prisma.timeOff.create({
    data: {
      userId: valentina.id,
      start: localTime(4, 10, 0),
      end: localTime(4, 14, 0),
      reason: "Curso de coloración",
    },
  });

  const barbers = [mati, bruno, valentina];
  const statusPool = [
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ];

  const appointments: {
    clientId: string;
    barberId: string;
    serviceId: string;
    start: Date;
    end: Date;
    status: string;
    priceCents: number;
    source: string;
    notes: string | null;
  }[] = [];

  const now = new Date();

  for (let dayOffset = -56; dayOffset <= 10; dayOffset++) {
    const dayStart = localInstant(dayOffset, 0);
    const weekday = Number(formatInTimeZone(dayStart, TZ, "i")) % 7;

    const hours = await prisma.businessHour.findUnique({ where: { weekday } });
    if (!hours?.active) continue;

    for (const barber of barbers) {
      let cursor = hours.openMinute;
      while (cursor < hours.closeMinute - 30) {
        if (rng() < 0.22) {
          cursor += 30;
          continue;
        }

        const service = pick(services);
        if (cursor + service.durationMin > hours.closeMinute) break;

        const client =
          rng() < 0.55
            ? pick(
                clients.filter(
                  (c) => c.preferredBarberId === barber.id,
                ).length > 0
                  ? clients.filter(
                      (c) => c.preferredBarberId === barber.id,
                    )
                  : clients,
              )
            : pick(clients);

        const start = localInstant(dayOffset, cursor);
        const end = new Date(start.getTime() + service.durationMin * 60_000);

        let status: string;
        if (end < now) {
          status = pick(statusPool);
        } else if (dayOffset === 0) {
          status = rng() < 0.35 ? "PENDING" : "CONFIRMED";
        } else {
          status = rng() < 0.25 ? "PENDING" : "CONFIRMED";
          if (rng() < 0.08) status = "CANCELLED";
        }

        appointments.push({
          clientId: client.id,
          barberId: barber.id,
          serviceId: service.id,
          start,
          end,
          status,
          priceCents: service.priceCents,
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

        cursor +=
          service.durationMin +
          10 +
          (rng() < 0.35 ? 15 : 0);
      }
    }
  }

  console.log(`Creando ${appointments.length} turnos...`);
  for (let i = 0; i < appointments.length; i += 200) {
    await prisma.appointment.createMany({
      data: appointments.slice(i, i + 200),
    });
  }

  const upcoming = appointments
    .filter((a) => a.start > now && a.status === "CONFIRMED")
    .slice(0, 6);

  await prisma.notification.createMany({
    data: [
      {
        userId: mati.id,
        title: "Bienvenido a En-silla",
        body: "Este es tu panel de operación diaria. Desde acá podés ver la agenda, la caja del día y las preferencias de cada cliente.",
        href: "/panel",
        readAt: null,
      },
      ...barbers.map((barber) => ({
        userId: barber.id,
        title: "Agenda del día lista",
        body: "Revisá tus turnos de hoy y los clientes que vuelven. Sus preferencias están guardadas en cada ficha.",
        href: "/panel/agenda",
        readAt: null,
      })),
      ...upcoming.map((a) => ({
        userId: a.barberId,
        title: "Nuevo turno confirmado",
        body: `${clients.find((c) => c.id === a.clientId)?.name ?? "Cliente"} reservó para el ${new Intl.DateTimeFormat(SHOP_LOCALE, { dateStyle: "short", timeStyle: "short", timeZone: TZ }).format(a.start)}.`,
        href: "/panel/agenda",
        readAt: rng() < 0.4 ? new Date() : null,
      })),
    ],
  });

  console.log("Listo.");
  console.log("Admin:   admin@ensilla.app / admin123");
  console.log("Barberos: bruno@ensilla.app / barber123");
  console.log("          valentina@ensilla.app / barber123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
