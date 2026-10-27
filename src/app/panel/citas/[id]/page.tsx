import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Mail,
  MessageCircle,
  Phone,
  Scissors,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  markReminderSentAction,
  updateAppointmentNotesAction,
  updateAppointmentStatusAction,
} from "@/app/actions/appointments";
import { Flash } from "@/components/ui/flash";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import {
  dateKey,
  formatDate,
  formatDateTime,
  formatLongDate,
  formatTimeRange,
} from "@/lib/datetime";
import { formatMoney, initials, whatsappLink } from "@/lib/format";
import { suggestIdeas } from "@/lib/ideas";
import { prisma } from "@/lib/prisma";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Detalle del turno",
};

export default async function AppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, query, user, shop] = await Promise.all([
    params,
    searchParams,
    requireUser(),
    getShop(),
  ]);
  const tz = shop.timezone;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: {
        include: { preferredBarber: { select: { name: true } } },
      },
      service: true,
      barber: true,
    },
  });

  if (!appointment) notFound();
  if (user.role !== "ADMIN" && appointment.barberId !== user.id) notFound();

  const completedVisits = await prisma.appointment.count({
    where: { clientId: appointment.clientId, status: "COMPLETED" },
  });

  const suggestions = suggestIdeas(appointment.client, {
    visits: completedVisits,
  });

  const redirectTo = `/panel/citas/${appointment.id}`;
  const client = appointment.client;
  const dayKey = dateKey(appointment.start, tz);
  const reminderMessage = `Hola ${client.name}, te recordamos tu turno en ${shop.name} el ${formatLongDate(appointment.start, tz)} a las ${formatTimeRange(appointment.start, appointment.end, tz)} para ${appointment.service.name}. ¡Te esperamos!`;

  const statusActions: { status: string; label: string; className: string }[] =
    [];
  if (appointment.status === "PENDING") {
    statusActions.push({
      status: "CONFIRMED",
      label: "Confirmar turno",
      className: "btn-dark",
    });
  }
  if (!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    statusActions.push({
      status: "COMPLETED",
      label: "Marcar completado",
      className: "btn-secondary",
    });
    statusActions.push({
      status: "NO_SHOW",
      label: "No vino",
      className: "btn-ghost",
    });
    statusActions.push({
      status: "CANCELLED",
      label: "Cancelar",
      className: "btn-ghost text-rose-600 hover:bg-rose-50",
    });
  }
  if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    statusActions.push({
      status: "CONFIRMED",
      label: "Reactivar turno",
      className: "btn-secondary",
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/panel/agenda?date=${dayKey}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Volver a la agenda
        </Link>
        <div className="flex gap-2">
          <a
            href={`/api/turno/${appointment.id}/ics`}
            className="btn-secondary btn-sm"
          >
            <CalendarPlus className="size-3.5" />
            Calendario
          </a>
          <Link
            href={`/panel/citas/nueva?client=${client.id}&date=${dayKey}`}
            className="btn-primary btn-sm"
          >
            Nuevo turno
          </Link>
        </div>
      </div>

      <Flash ok={query.ok} error={query.error} />

      <div className="card overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-line bg-sand/30 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-copper">
              {formatLongDate(appointment.start, tz)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {formatTimeRange(appointment.start, appointment.end, tz)}
              </h1>
              <StatusBadge status={appointment.status} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {appointment.service.name} ·{" "}
              {appointment.service.durationMin} min ·{" "}
              {formatMoney(appointment.priceCents, shop.currency)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {statusActions.map((action) => (
              <form key={action.status} action={updateAppointmentStatusAction}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="status" value={action.status} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <button type="submit" className={`${action.className} btn-sm`}>
                  {action.label}
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-cream">
                    {initials(client.name)}
                  </span>
                  <div>
                    <p className="font-semibold">{client.name}</p>
                    <p className="text-xs text-stone-400">
                      {completedVisits}{" "}
                      {completedVisits === 1 ? "visita" : "visitas"}{" "}
                      completadas
                    </p>
                  </div>
                </div>
                <Link
                  href={`/panel/clientes/${client.id}`}
                  className="text-xs font-semibold text-copper"
                >
                  Ver ficha
                </Link>
              </div>

              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 rounded-lg bg-sand/50 px-3 py-2"
                >
                  <Phone className="size-3.5 text-copper" />
                  {client.phone}
                </a>
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-2 truncate rounded-lg bg-sand/50 px-3 py-2"
                  >
                    <Mail className="size-3.5 text-copper" />
                    {client.email}
                  </a>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {client.hairType && (
                  <span className="chip">Cabello: {client.hairType}</span>
                )}
                {client.preferredStyle && (
                  <span className="chip">Estilo: {client.preferredStyle}</span>
                )}
                {client.products && (
                  <span className="chip">Producto: {client.products}</span>
                )}
                {client.allergies && (
                  <span className="chip border-rose-200 bg-rose-50 text-rose-700">
                    Alergias: {client.allergies}
                  </span>
                )}
              </div>

              {client.notes && (
                <p className="mt-3 rounded-lg bg-sand/40 px-3 py-2 text-xs leading-relaxed text-stone-600">
                  {client.notes}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-line p-4">
              <p className="mb-3 text-sm font-semibold">Notas del turno</p>
              <form action={updateAppointmentNotesAction} className="space-y-3">
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={600}
                  defaultValue={appointment.notes ?? ""}
                  className="textarea"
                  placeholder="Detalles del corte, pedidos del cliente, algo para recordar..."
                />
                <div className="flex justify-end">
                  <button type="submit" className="btn-secondary btn-sm">
                    Guardar notas
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-line p-4">
              <div className="flex items-center gap-2">
                <Scissors className="size-4 text-copper" />
                <p className="text-sm font-semibold">Detalle del servicio</p>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between rounded-lg bg-sand/40 px-3 py-2">
                  <dt className="text-stone-500">Barbero</dt>
                  <dd className="font-medium">{appointment.barber.name}</dd>
                </div>
                <div className="flex justify-between rounded-lg bg-sand/40 px-3 py-2">
                  <dt className="text-stone-500">Precio</dt>
                  <dd className="font-medium">
                    {formatMoney(appointment.priceCents, shop.currency)}
                  </dd>
                </div>
                <div className="flex justify-between rounded-lg bg-sand/40 px-3 py-2">
                  <dt className="text-stone-500">Origen</dt>
                  <dd className="font-medium">
                    {appointment.source === "PUBLIC"
                      ? "Reserva online"
                      : "Cargado por el equipo"}
                  </dd>
                </div>
                <div className="flex justify-between rounded-lg bg-sand/40 px-3 py-2">
                  <dt className="text-stone-500">Creado</dt>
                  <dd className="font-medium">
                    {formatDate(appointment.createdAt, "d MMM · HH:mm", tz)}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Recordatorio</p>
                {appointment.reminderSentAt ? (
                  <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
                    <CheckCircle2 className="size-3" />
                    Enviado
                  </span>
                ) : (
                  <span className="badge bg-sand text-stone-500 ring-transparent">
                    Pendiente
                  </span>
                )}
              </div>

              {appointment.reminderSentAt && (
                <p className="mt-2 text-xs text-stone-500">
                  Marcado el{" "}
                  {formatDateTime(appointment.reminderSentAt, tz)}.
                </p>
              )}

              <div className="mt-3 space-y-2">
                <a
                  href={whatsappLink(client.phone, reminderMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary w-full btn-sm"
                >
                  <MessageCircle className="size-3.5" />
                  Enviar recordatorio por WhatsApp
                </a>
                {!appointment.reminderSentAt && (
                  <form action={markReminderSentAction}>
                    <input type="hidden" name="id" value={appointment.id} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={redirectTo}
                    />
                    <button type="submit" className="btn-ghost w-full btn-sm">
                      Marcar como enviado
                    </button>
                  </form>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-amber/30 bg-amber/[0.07] p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-copper" />
                <p className="text-sm font-semibold">
                  Ideas para su próximo corte
                </p>
              </div>
              <div className="mt-3 space-y-3">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.title}>
                    <p className="flex items-start gap-1.5 text-xs font-semibold text-ink">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-copper" />
                      {suggestion.title}
                    </p>
                    <p className="mt-0.5 pl-5 text-[11px] leading-relaxed text-stone-500">
                      {suggestion.description}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href={`/panel/clientes/${client.id}#ideas`}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-copper"
              >
                Guardar una idea en la ficha
                <UserRound className="size-3" />
              </Link>
            </section>

            <section className="rounded-2xl border border-line p-4 text-xs text-stone-500">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Clock3 className="size-4 text-copper" />
                Cliente frecuente
              </div>
              <p className="mt-2 leading-relaxed">
                {client.preferredBarber
                  ? `Suele atenderse con ${client.preferredBarber.name}.`
                  : "Todavía no tiene un barbero preferido registrado."}{" "}
                Guardá sus preferencias para que la próxima visita sea todavía
                más personal.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
