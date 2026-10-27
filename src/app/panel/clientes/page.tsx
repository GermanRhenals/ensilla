import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import { formatMoney, initials } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireUser();
  const shop = await getShop();
  const query = (params.q ?? "").trim();

  const [clients, totals] = await Promise.all([
    prisma.client.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query } },
              {
                phone: {
                  contains: query.replace(/\D/g, "") || query,
                },
              },
              ...(query.includes("@") ? [{ email: { contains: query } }] : []),
            ],
          }
        : {},
      orderBy: { name: "asc" },
      take: 200,
      include: {
        preferredBarber: { select: { name: true, color: true } },
        _count: { select: { appointments: true } },
      },
    }),
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { status: "COMPLETED" },
      _sum: { priceCents: true },
      _max: { start: true },
    }),
  ]);

  const totalMap = new Map(
    totals.map((item) => [
      item.clientId,
      { spent: item._sum.priceCents ?? 0, last: item._max.start },
    ]),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            Clientes
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            La memoria de la barbería
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Preferencias, historial e ideas para que cada visita se sienta
            única.
          </p>
        </div>
        <Link href="/panel/clientes/nuevo" className="btn-primary self-start">
          <Plus className="size-4" />
          Nuevo cliente
        </Link>
      </div>

      <Flash ok={params.ok} error={params.error} />

      <form
        action="/panel/clientes"
        method="get"
        className="card flex items-end gap-2 p-4"
      >
        <div className="flex-1">
          <label className="label" htmlFor="q">
            Buscar cliente
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              id="q"
              name="q"
              defaultValue={query}
              className="input pl-9"
              placeholder="Nombre, teléfono o email"
            />
          </div>
        </div>
        <button type="submit" className="btn-secondary">
          Buscar
        </button>
        {query && (
          <Link href="/panel/clientes" className="btn-ghost">
            Limpiar
          </Link>
        )}
      </form>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-medium">
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"}
            {query ? ` para “${query}”` : ""}
          </p>
          <p className="text-xs text-stone-400">{shop.name}</p>
        </div>

        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-sand text-stone-500">
              <Users className="size-5" />
            </span>
            <p className="mt-3 font-medium">
              {query
                ? "No encontramos clientes con esa búsqueda."
                : "Todavía no hay clientes cargados."}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Podés crear una ficha nueva o esperar la primera reserva online.
            </p>
            <Link href="/panel/clientes/nuevo" className="btn-primary mt-4">
              <Plus className="size-4" />
              Nuevo cliente
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/30 text-left text-[10px] uppercase tracking-[0.12em] text-stone-400">
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 font-semibold">Preferencias</th>
                  <th className="px-4 py-2.5 font-semibold">Barbero</th>
                  <th className="px-4 py-2.5 font-semibold">Visitas</th>
                  <th className="px-4 py-2.5 font-semibold">Última</th>
                  <th className="px-4 py-2.5 font-semibold">Total</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clients.map((client) => {
                  const stats = totalMap.get(client.id);
                  return (
                    <tr
                      key={client.id}
                      className="transition hover:bg-sand/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-full bg-ink text-[10px] font-semibold text-cream">
                            {initials(client.name)}
                          </span>
                          <div>
                            <Link
                              href={`/panel/clientes/${client.id}`}
                              className="font-medium hover:text-copper"
                            >
                              {client.name}
                            </Link>
                            <p className="text-xs text-stone-400">
                              {client.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-[240px] flex-wrap gap-1">
                          {client.hairType && (
                            <span className="chip">{client.hairType}</span>
                          )}
                          {client.preferredStyle && (
                            <span className="chip">
                              {client.preferredStyle}
                            </span>
                          )}
                          {!client.hairType && !client.preferredStyle && (
                            <span className="text-xs text-stone-300">
                              Sin datos
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {client.preferredBarber ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="size-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  client.preferredBarber.color,
                              }}
                            />
                            {client.preferredBarber.name.split(" ")[0]}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-300">
                            Cualquiera
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {client._count.appointments}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500">
                        {stats?.last
                          ? formatDate(stats.last, "d MMM yy", shop.timezone)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {formatMoney(stats?.spent ?? 0, shop.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/panel/clientes/${client.id}`}
                          className="text-xs font-semibold text-copper"
                        >
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
