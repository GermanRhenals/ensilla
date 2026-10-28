"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  MessageCircle,
  Phone,
  Scissors,
  StickyNote,
  UserX,
  XCircle,
} from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/lib/auth-context";
import type { AppointmentStatus } from "@/lib/constants";
import {
  fetchAppointmentDetail,
  fetchShop,
  markReminderSent,
  updateAppointmentNotes,
  updateAppointmentStatus,
} from "@/lib/data";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatMoney, whatsappLink } from "@/lib/format";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { useAsync } from "@/lib/use-async";

export default function AppointmentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <AppointmentDetailContent />
    </Suspense>
  );
}

const STATUS_ACTIONS: {
  status: AppointmentStatus;
  label: string;
  icon: typeof CheckCircle2;
}[] = [
  { status: "CONFIRMED", label: "Confirmar", icon: CheckCircle2 },
  { status: "COMPLETED", label: "Completar", icon: CheckCircle2 },
  { status: "NO_SHOW", label: "No vino", icon: UserX },
  { status: "CANCELLED", label: "Cancelar", icon: XCircle },
];

function AppointmentDetailContent() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const { profile } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const { data, reload, error: loadError } = useAsync(async () => {
    if (!id) return null;
    const [shop, appointment] = await Promise.all([
      fetchShop(),
      fetchAppointmentDetail(id),
    ]);
    return { shop, appointment };
  }, `appointment-${id}`);

  if (loadError) return <Flash error={loadError} />;
  if (!profile || !data) return null;
  if (!data.appointment) {
    return (
      <div className="card card-pad text-center text-sm text-stone-500">
        No encontramos ese turno.
      </div>
    );
  }

  const { shop, appointment } = data;
  const tz = shop.timezone;
  const start = new Date(appointment.start);
  const end = new Date(appointment.end);
  const client = appointment.client;
  const service = appointment.service;
  const barber = appointment.barber;

  async function changeStatus(status: AppointmentStatus) {
    setMessage(null);
    setError(null);
    setPending(status);
    try {
      await updateAppointmentStatus(appointment.id, status);
      setMessage("Estado actualizado.");
      reload();
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "No se pudo actualizar el turno.",
      );
    } finally {
      setPending(null);
    }
  }

  async function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setPending("notes");
    const formData = new FormData(event.currentTarget);
    try {
      await updateAppointmentNotes(
        appointment.id,
        String(formData.get("notes") || ""),
      );
      setMessage("Notas guardadas.");
      reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudieron guardar las notas.",
      );
    } finally {
      setPending(null);
    }
  }

  async function downloadCalendar() {
    setMessage(null);
    setError(null);
    try {
      const content = buildIcs({
        id: appointment.id,
        start,
        end,
        title: `${service.name} · ${shop.name}`,
        description: `Turno de ${client.name} con ${barber.name}.`,
        location: shop.address ?? undefined,
      });
      downloadIcs(content, `turno-${appointment.id.slice(0, 8)}.ics`);
      await markReminderSent(appointment.id);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "No se pudo descargar el calendario.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/panel/citas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Volver a turnos
        </Link>
        <StatusBadge status={appointment.status} />
      </div>

      <Flash ok={message ?? undefined} error={error ?? undefined} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-copper">
              {formatDate(start, "EEEE d 'de' MMMM", tz)}
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              {formatTime(start, tz)} — {formatTime(end, tz)}
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {service.name} · {service.durationMin} min ·{" "}
              {formatMoney(appointment.priceCents, shop.currency, shop.locale)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadCalendar}
              className="btn-secondary btn-sm"
            >
              <Download className="size-3.5" />
              Calendario
            </button>
            <a
              href={whatsappLink(
                client.phone,
                `Hola ${client.name.split(" ")[0]}! Te recordamos tu turno de ${service.name} para el ${formatDate(start, "d/M", tz)} a las ${formatTime(start, tz)} en ${shop.name}.`,
                shop.whatsappCountryCode,
              )}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary btn-sm"
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </a>
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <Link
            href={`/panel/clientes/detalle?id=${client.id}`}
            className="group rounded-xl border border-line p-4 transition hover:border-copper/40 hover:bg-sand/20"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Cliente
            </p>
            <p className="mt-1 font-display text-lg font-semibold group-hover:text-copper">
              {client.name}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
              <Phone className="size-3" />
              {client.phone}
            </p>
          </Link>

          <div className="rounded-xl border border-line p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Barbero
            </p>
            <p className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: barber.color }}
              />
              {barber.name}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone-500">
              <Scissors className="size-3" />
              {service.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-3">
          <div className="px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Origen
            </p>
            <p className="mt-1 text-sm font-medium">
              {appointment.source === "PUBLIC" ? "Reserva online" : "Panel"}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Precio
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatMoney(appointment.priceCents, shop.currency, shop.locale)}
            </p>
          </div>
          <div className="col-span-2 px-4 py-3.5 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Creado
            </p>
            <p className="mt-1 text-sm font-medium">
              {formatDate(new Date(appointment.createdAt), "d MMM yyyy", tz)}
            </p>
          </div>
        </div>
      </div>

      <section className="card card-pad">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-copper" />
          <h2 className="font-semibold">Cambiar estado</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_ACTIONS.map((action) => {
            const Icon = action.icon;
            const active = appointment.status === action.status;
            return (
              <button
                key={action.status}
                type="button"
                disabled={active || pending !== null}
                onClick={() => changeStatus(action.status)}
                className={`btn-sm ${
                  active ? "btn-primary" : "btn-secondary"
                }`}
              >
                {pending === action.status ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Icon className="size-3.5" />
                )}
                {action.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card card-pad">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-copper" />
          <h2 className="font-semibold">Notas internas</h2>
        </div>
        <form onSubmit={saveNotes} className="mt-3 space-y-3">
          <textarea
            name="notes"
            rows={4}
            maxLength={600}
            defaultValue={appointment.notes ?? ""}
            className="textarea"
            placeholder="Detalles del corte, preferencias, cosas a recordar..."
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={pending !== null}
            >
              {pending === "notes" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Guardar notas
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap gap-2 text-xs text-stone-400">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3" />
          Turno {appointment.id.slice(0, 8)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3" />
          {formatDate(start, "d MMM yyyy", tz)}
        </span>
      </div>
    </div>
  );
}
