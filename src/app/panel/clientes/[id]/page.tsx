import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Lightbulb,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  addIdeaAction,
  deleteIdeaAction,
  updateClientAction,
} from "@/app/actions/clients";
import { Flash } from "@/components/ui/flash";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatMoney, initials, whatsappLink } from "@/lib/format";
import { suggestIdeas } from "@/lib/ideas";
import { prisma } from "@/lib/prisma";
import { getActiveBarbers, getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Ficha del cliente",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireUser();
  const [{ id }, query, shop, barbers] = await Promise.all([
    params,
    searchParams,
    getShop(),
    getActiveBarbers(),
  ]);
  const tz = shop.timezone;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      preferredBarber: { select: { id: true, name: true, color: true } },
      ideas: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      appointments: {
        orderBy: { start: "desc" },
        take: 100,
        include: {
          service: { select: { name: true, durationMin: true } },
          barber: { select: { name: true, color: true } },
        },
      },
    },
  });

  if (!client) notFound();

  const completed = client.appointments.filter(
    (appointment) => appointment.status === "COMPLETED",
  );
  const totalSpent = completed.reduce(
    (total, appointment) => total + appointment.priceCents,
    0,
  );
  const lastVisit = completed[0]?.start ?? null;
  const upcoming = client.appointments
    .filter(
      (appointment) =>
        appointment.start > new Date() &&
        (appointment.status === "CONFIRMED" ||
          appointment.status === "PENDING"),
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  const savedTitles = new Set(client.ideas.map((idea) => idea.title));
  const suggestions = suggestIdeas(client, {
    visits: completed.length,
  })
    .filter((suggestion) => !savedTitles.has(suggestion.title))
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/panel/clientes"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Volver a clientes
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href={`tel:${client.phone}`}
            className="btn-secondary btn-sm"
          >
            <Phone className="size-3.5" />
            Llamar
          </a>
          <a
            href={whatsappLink(
              client.phone,
              `Hola ${client.name.split(" ")[0]}! Te escribimos de ${shop.name}.`,
            )}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-sm"
          >
            <MessageCircle className="size-3.5" />
            WhatsApp
          </a>
          <Link
            href={`/panel/citas/nueva?client=${client.id}`}
            className="btn-primary btn-sm"
          >
            <CalendarPlus className="size-3.5" />
            Nuevo turno
          </Link>
        </div>
      </div>

      <Flash ok={query.ok} error={query.error} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-ink font-display text-lg font-semibold text-cream">
              {initials(client.name)}
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {client.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3" />
                  {client.phone}
                </span>
                {client.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3" />
                    {client.email}
                  </span>
                )}
                {client.birthDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3" />
                    {formatDate(client.birthDate, "d 'de' MMMM", tz)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {client.preferredBarber && (
              <span className="chip">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: client.preferredBarber.color }}
                />
                {client.preferredBarber.name}
              </span>
            )}
            {client.hairType && <span className="chip">{client.hairType}</span>}
            {client.preferredStyle && (
              <span className="chip">{client.preferredStyle}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-4">
          {[
            {
              label: "Visitas completadas",
              value: completed.length,
            },
            {
              label: "Total gastado",
              value: formatMoney(totalSpent, shop.currency),
            },
            {
              label: "Última visita",
              value: lastVisit
                ? formatDate(lastVisit, "d MMM yyyy", tz)
                : "Sin visitas",
            },
            {
              label: "Próximo turno",
              value: upcoming
                ? `${formatDate(upcoming.start, "d MMM", tz)} · ${formatTime(upcoming.start, tz)}`
                : "Sin agendar",
            },
          ].map((item) => (
            <div key={item.label} className="px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                {item.label}
              </p>
              <p className="mt-1 font-display text-lg font-semibold">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <section id="ficha" className="card card-pad">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserRound className="size-4 text-copper" />
                <h2 className="font-semibold">Ficha y preferencias</h2>
              </div>
              <span className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
                Editable
              </span>
            </div>

            <form action={updateClientAction} className="mt-4 space-y-3.5">
              <input type="hidden" name="id" value={client.id} />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="name">
                    Nombre
                  </label>
                  <input
                    id="name"
                    name="name"
                    defaultValue={client.name}
                    required
                    minLength={2}
                    maxLength={80}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    Teléfono
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    defaultValue={client.phone}
                    required
                    minLength={6}
                    maxLength={30}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={client.email ?? ""}
                    maxLength={160}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="birthDate">
                    Cumpleaños
                  </label>
                  <input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    defaultValue={
                      client.birthDate
                        ? formatDate(client.birthDate, "yyyy-MM-dd", tz)
                        : ""
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="hairType">
                    Tipo de cabello
                  </label>
                  <input
                    id="hairType"
                    name="hairType"
                    defaultValue={client.hairType ?? ""}
                    maxLength={120}
                    className="input"
                    placeholder="Ondulado medio"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="preferredStyle">
                    Estilo preferido
                  </label>
                  <input
                    id="preferredStyle"
                    name="preferredStyle"
                    defaultValue={client.preferredStyle ?? ""}
                    maxLength={160}
                    className="input"
                    placeholder="Fade bajo con textura"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="products">
                    Productos
                  </label>
                  <input
                    id="products"
                    name="products"
                    defaultValue={client.products ?? ""}
                    maxLength={160}
                    className="input"
                    placeholder="Pomada mate"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="allergies">
                    Alergias / cuidados
                  </label>
                  <input
                    id="allergies"
                    name="allergies"
                    defaultValue={client.allergies ?? ""}
                    maxLength={200}
                    className="input"
                    placeholder="Piel sensible"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="preferredBarberId">
                    Barbero preferido
                  </label>
                  <select
                    id="preferredBarberId"
                    name="preferredBarberId"
                    defaultValue={client.preferredBarberId ?? ""}
                    className="select"
                  >
                    <option value="">Sin preferencia</option>
                    {barbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="notes">
                    Notas internas
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    defaultValue={client.notes ?? ""}
                    maxLength={600}
                    className="textarea"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary btn-sm">
                  Guardar ficha
                </button>
              </div>
            </form>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="font-semibold">Historial de visitas</h2>
                <p className="text-xs text-stone-500">
                  {client.appointments.length} turnos registrados
                </p>
              </div>
              <Scissors className="size-4 text-copper" />
            </div>

            {client.appointments.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-stone-500">
                Todavía no tiene turnos. Podés cargar el primero desde el botón
                de arriba.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto scroll-thin">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 bg-sand/80 backdrop-blur">
                    <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-stone-400">
                      <th className="px-4 py-2 font-semibold">Fecha</th>
                      <th className="px-4 py-2 font-semibold">Servicio</th>
                      <th className="px-4 py-2 font-semibold">Barbero</th>
                      <th className="px-4 py-2 font-semibold">Precio</th>
                      <th className="px-4 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {client.appointments.map((appointment) => (
                      <tr
                        key={appointment.id}
                        className="transition hover:bg-sand/20"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <Link
                            href={`/panel/citas/${appointment.id}`}
                            className="font-medium hover:text-copper"
                          >
                            {formatDate(
                              appointment.start,
                              "d MMM yy",
                              tz,
                            )}
                          </Link>
                          <p className="text-[10px] tabular-nums text-stone-400">
                            {formatTime(appointment.start, tz)}
                          </p>
                        </td>
                        <td className="px-4 py-2.5">
                          {appointment.service.name}
                        </td>
                        <td className="px-4 py-2.5">
                          {appointment.barber.name.split(" ")[0]}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {formatMoney(appointment.priceCents, shop.currency)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={appointment.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section
            id="ideas"
            className="card card-pad border-amber/40 bg-amber/[0.05]"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-copper" />
              <h2 className="font-semibold">Ideas para su próximo corte</h2>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Sugerencias según su estilo, su historial y lo que contó.
            </p>

            {suggestions.length > 0 && (
              <div className="mt-4 space-y-2.5">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.title}
                    className="rounded-xl border border-amber/30 bg-white p-3.5"
                  >
                    <p className="flex items-start gap-1.5 text-sm font-semibold">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-copper" />
                      {suggestion.title}
                    </p>
                    <p className="mt-1 pl-5 text-xs leading-relaxed text-stone-500">
                      {suggestion.description}
                    </p>
                    <form action={addIdeaAction} className="mt-2 pl-5">
                      <input type="hidden" name="clientId" value={client.id} />
                      <input
                        type="hidden"
                        name="title"
                        value={suggestion.title}
                      />
                      <input
                        type="hidden"
                        name="description"
                        value={suggestion.description}
                      />
                      <input type="hidden" name="tags" value={suggestion.tags} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-copper"
                      >
                        <Plus className="size-3" />
                        Guardar en la ficha
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-amber/20 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Guardadas
              </p>
              {client.ideas.length === 0 ? (
                <p className="mt-2 text-xs text-stone-500">
                  Todavía no hay ideas guardadas.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {client.ideas.map((idea) => (
                    <div
                      key={idea.id}
                      className="rounded-xl border border-line bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold">{idea.title}</p>
                        <form action={deleteIdeaAction}>
                          <input type="hidden" name="id" value={idea.id} />
                          <input
                            type="hidden"
                            name="clientId"
                            value={client.id}
                          />
                          <button
                            type="submit"
                            className="text-stone-300 transition hover:text-rose-500"
                            aria-label="Eliminar idea"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </form>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                        {idea.description}
                      </p>
                      <p className="mt-1.5 text-[10px] text-stone-400">
                        {idea.createdBy?.name ?? "Equipo"} ·{" "}
                        {formatDate(idea.createdAt, "d MMM", tz)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              action={addIdeaAction}
              className="mt-4 space-y-2.5 border-t border-amber/20 pt-4"
            >
              <input type="hidden" name="clientId" value={client.id} />
              <div>
                <label className="label" htmlFor="idea-title">
                  Nueva idea
                </label>
                <input
                  id="idea-title"
                  name="title"
                  required
                  minLength={3}
                  maxLength={100}
                  className="input"
                  placeholder="Título, ej: Flequillo cortina"
                />
              </div>
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={600}
                rows={2}
                className="textarea"
                placeholder="Por qué le quedaría bien y cómo lo harías..."
              />
              <input
                name="tags"
                maxLength={120}
                className="input"
                placeholder="tags: textura, ondulado"
              />
              <button type="submit" className="btn-secondary btn-sm w-full">
                <Plus className="size-3.5" />
                Guardar idea
              </button>
            </form>
          </section>

          <section className="card p-4 text-xs leading-relaxed text-stone-500">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Lightbulb className="size-4 text-copper" />
              Antes de que llegue
            </p>
            <p className="mt-2">
              {client.preferredStyle
                ? `Ya sabés que busca algo como “${client.preferredStyle}”. Tené una variante lista para proponerle.`
                : "Aprovechá la primera visita para preguntar por su rutina y anotar el estilo que quiere lograr."}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
