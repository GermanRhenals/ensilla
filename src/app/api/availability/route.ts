import { NextResponse, type NextRequest } from "next/server";
import { getAvailability } from "@/lib/availability";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? "";
  const serviceId = searchParams.get("serviceId") ?? "";
  const barber = searchParams.get("barberId") ?? "any";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
    return NextResponse.json(
      { error: "Parámetros inválidos.", slots: [] },
      { status: 400 },
    );
  }

  const slots = await getAvailability({
    dayKey: date,
    serviceId,
    barberId: barber === "any" ? undefined : barber,
  });

  return NextResponse.json(
    { slots },
    { headers: { "Cache-Control": "no-store" } },
  );
}
