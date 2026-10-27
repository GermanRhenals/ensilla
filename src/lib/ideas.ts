export type IdeaSuggestion = {
  title: string;
  description: string;
  tags: string;
};

type ClientLike = {
  hairType?: string | null;
  preferredStyle?: string | null;
  products?: string | null;
  allergies?: string | null;
  notes?: string | null;
};

const CATALOG: Record<string, IdeaSuggestion[]> = {
  rizado: [
    {
      title: "Definición sin frizz",
      description:
        "Corte en seco para respetar la forma del rizo, lavado con producto sin sulfatos y secado con difusor a temperatura baja.",
      tags: "rizos, cuidado, definición",
    },
    {
      title: "Capas que abrazan el rizo",
      description:
        "Capas medianas que acompañan la curva natural y liberan volumen sin perder forma. Probar leave-in liviano.",
      tags: "capas, rizado, volumen",
    },
    {
      title: "Taper respetando el volumen",
      description:
        "Degradar solo sienes y nuca deja la parte superior con movimiento natural. Ideal para sumar prolijidad sin perder identidad.",
      tags: "taper, fade, rizos",
    },
  ],
  ondulado: [
    {
      title: "Textura con sal marina",
      description:
        "Aprovechar la onda natural con spray salino y secado suave. Un corte con capas largas potencia el movimiento.",
      tags: "ondulado, textura, playa",
    },
    {
      title: "Flequillo cortina",
      description:
        "Un flequillo largo y abierto enmarca el rostro y se integra con la onda. Fácil de llevar hacia los costados.",
      tags: "flequillo, tendencia, ondulado",
    },
    {
      title: "Fade bajo con movimiento",
      description:
        "Laterales limpios y parte superior con textura despeinada. Funciona muy bien con pomada mate y secador suave.",
      tags: "fade, textura, mate",
    },
  ],
  liso: [
    {
      title: "Capas invisibles",
      description:
        "Capas largas que aportan movimiento sin quitar peso ni largo. Terminar con texturizador en spray.",
      tags: "capas, liso, movimiento",
    },
    {
      title: "Bob con volumen controlado",
      description:
        "Un bob a la mandíbula con capas internas da aire al cabello fino. Peinar con secador y cepillo redondo.",
      tags: "bob, volumen, liso",
    },
    {
      title: "Clásico con raya marcada",
      description:
        "Raya al costado, volumen moderado y fijación con cera de brillo. Un clásico que siempre vuelve.",
      tags: "clásico, raya, prolijo",
    },
  ],
  fade: [
    {
      title: "Contornos a navaja",
      description:
        "Refrescar patillas y nuca a navaja cada dos o tres semanas mantiene el degradado nítido por más tiempo.",
      tags: "fade, navaja, mantenimiento",
    },
    {
      title: "Diseño lateral discreto",
      description:
        "Una línea fina en un costado suma personalidad sin recargar. Se puede repetir en el próximo corte.",
      tags: "diseño, línea, personalidad",
    },
    {
      title: "Degradado con textura arriba",
      description:
        "Subir el fade en las sienes y trabajar la parte superior con textura hacia adelante para un look moderno.",
      tags: "fade, textura, moderno",
    },
  ],
  barba: [
    {
      title: "Ritual de barba completa",
      description:
        "Toalla caliente, perfilado con navaja y bálsamo para cerrar. Un mimo extra que el cliente recuerda.",
      tags: "barba, navaja, ritual",
    },
    {
      title: "Perfilado y aceite",
      description:
        "Definir mejillas y cuello, y recomendar aceite para hidratar. Mantiene la barba ordenada entre visitas.",
      tags: "barba, cuidado, perfilado",
    },
    {
      title: "Combo corte + barba",
      description:
        "Proponer el combo completo cuando la barba tenga más de tres semanas. El resultado se nota en la foto final.",
      tags: "combo, barba, corte",
    },
  ],
  general: [
    {
      title: "Asesoría de imagen",
      description:
        "Dedicar cinco minutos a repasar rutina, productos y próximo corte. La conversación también es parte del servicio.",
      tags: "asesoría, experiencia",
    },
    {
      title: "Mantenimiento cada tres semanas",
      description:
        "Agendar el próximo turno antes de irse reduce ausencias y mantiene el corte en su mejor punto.",
      tags: "mantenimiento, agenda",
    },
    {
      title: "Cambio de look gradual",
      description:
        "Probar un cambio pequeño primero: flequillo, línea o largo de laterales. Menos riesgo y más confianza.",
      tags: "cambio, look, confianza",
    },
  ],
};

function pickTags(client: ClientLike) {
  const haystack = [
    client.hairType,
    client.preferredStyle,
    client.products,
    client.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const buckets: string[] = [];
  if (haystack.includes("riz") || haystack.includes("crespo"))
    buckets.push("rizado");
  if (haystack.includes("ondul")) buckets.push("ondulado");
  if (haystack.includes("liso") || haystack.includes("fino"))
    buckets.push("liso");
  if (
    haystack.includes("fade") ||
    haystack.includes("degrad") ||
    haystack.includes("taper") ||
    haystack.includes("buzz")
  ) {
    buckets.push("fade");
  }
  if (haystack.includes("barba") || haystack.includes("afeit"))
    buckets.push("barba");
  return buckets;
}

export function suggestIdeas(
  client: ClientLike,
  options?: { visits?: number },
): IdeaSuggestion[] {
  const buckets = pickTags(client);
  const suggestions: IdeaSuggestion[] = [];
  const seen = new Set<string>();

  for (const bucket of buckets) {
    for (const idea of CATALOG[bucket] ?? []) {
      if (seen.has(idea.title)) continue;
      seen.add(idea.title);
      suggestions.push(idea);
      if (suggestions.length >= 3) return suggestions;
    }
  }

  for (const idea of CATALOG.general) {
    if (seen.has(idea.title)) continue;
    seen.add(idea.title);
    suggestions.push(idea);
    if (suggestions.length >= 3) break;
  }

  if ((options?.visits ?? 0) >= 5) {
    suggestions[2] = {
      title: "Cliente frecuente: cuidar el vínculo",
      description:
        "Ya es parte de la casa. Recordar su bebida, su barbero preferido y proponerle el próximo turno antes de salir.",
      tags: "fidelidad, experiencia, detalle",
    };
  }

  return suggestions;
}
