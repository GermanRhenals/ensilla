import { NextResponse } from "next/server";
import { buildIcs } from "@/lib/ics";
import { prisma } from "@/lib/prisma";
import { getShop } from "@/lib/shop";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [appointment, shop] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id },
      include: { service: true, barber: true, client: true },
    }),
    getShop(),
  ]);

  if (!appointment) {
    return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
  }

  const ics = buildIcs({
    id: appointment.id,
    start: appointment.start,
    end: appointment.end,
    title: `${appointment.service.name} en ${shop.name}`,
    description: [
      `Cliente: ${appointment.client.name}`,
      `Barbero: ${appointment.barber.name}`,
      `Servicio: ${appointment.service.name} (${appointment.service.durationMin} min)`,
      shop.phone ? `Teléfono: ${shop.phone}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    location: shop.address ?? shop.name,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ensilla-${appointment.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
