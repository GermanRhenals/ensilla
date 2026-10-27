"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { fromZonedTime } from "date-fns-tz";
import {
  ArrowLeft,
  CalendarPlus,
  Info,
  Loader2,
  UserPlus,
} from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import { createStaffAppointment } from "@/lib/booking";
import {
  fetchBarbers,
  fetchClients,
  fetchServices,
  fetchShop,
} from "@/lib/data";
import { todayKey } from "@/lib/datetime";
import { formatMoney } from "@/lib/format";
import { useAsync } from "@/lib/use-async";

export default function NewAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      }
    >
      <NewAppointmentContent />
    </Suspense>
  );
}

function NewAppointmentContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile: user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const clientParam = params.get("client");
  const dateParam = params.get("date");
  const timeParam = params.get("time");

  const { data } = useAsync(async () => {
    const [shop, clients, barbers, services] = await Promise.all([
      fetchShop(),
      fetchClients(),
      fetchBarbers(),
      fetchServices(true),
    ]);
    return {
      shop,
      clients,
      barbers: barbers.filter((barber) => barber.active),
      services,
    };
  }, "new-appointment");

  if (!user || !data) return null;

  const currentUser = user;
  const { shop, clients, barbers, services } = data;
  const selectedClient = clientParam
    ? clients.find((client) => client.id === clientParam)
    : undefined;

  const defaultBarberId =
    user.role === "ADMIN"
      ? (selectedClient?.preferredBarberId ?? barbers[0]?.id ?? "")
      : user.id;
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayKey(shop.timezone);
  const time =
    timeParam && /^\d{2}:\d{2}$/.test(timeParam) ? timeParam : "10:00";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const rawDate = String(formData.get("date") || date);
    const rawTime = String(formData.get("time") || time);

    const result = await createStaffAppointment({
      clientId: String(formData.get("clientId") || "") || undefined,
      clientName: String(formData.get("clientName") || "") || undefined,
      clientPhone: String(formData.get("clientPhone") || "") || undefined,
      clientEmail: String(formData.get("clientEmail") || "") || undefined,
      barberId: String(formData.get("barberId") || currentUser.id),
      serviceId: String(formData.get("serviceId") || ""),
      start: fromZonedTime(
        `${rawDate} ${rawTime}:00`,
        shop.timezone,
      ).toISOString(),
      status: String(formData.get("status") || "CONFIRMED"),
      notes: String(formData.get("notes") || "") || undefined,
      source: "STAFF",
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(`/panel/citas/detalle?id=${result.appointmentId}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/panel/agenda"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Volver a la agenda
        </Link>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Nueva cita
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Cargar un turno manual
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Para clientes que llaman, pasan por el local o reservan por
          WhatsApp.
        </p>
      </div>

      <Flash error={error ?? undefined} />

      <form
        onSubmit={submit}
        className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <section className="card card-pad">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-copper" />
            <h2 className="font-semibold">Cliente</h2>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="clientId">
              Cliente existente
            </label>
            <select
              id="clientId"
              name="clientId"
              defaultValue={selectedClient?.id ?? ""}
              className="select"
            >
              <option value="">— Cliente nuevo —</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-line bg-sand/30 p-3.5">
            <p className="text-xs font-semibold text-stone-600">
              Solo si es un cliente nuevo
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="clientName">
                  Nombre y apellido
                </label>
                <input
                  id="clientName"
                  name="clientName"
                  className="input"
                  placeholder="Nombre completo"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="label" htmlFor="clientPhone">
                  Teléfono
                </label>
                <input
                  id="clientPhone"
                  name="clientPhone"
                  className="input"
                  placeholder="11 5555-0101"
                  inputMode="tel"
                  maxLength={30}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="clientEmail">
                  Email (opcional)
                </label>
                <input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  className="input"
                  placeholder="cliente@email.com"
                  maxLength={160}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="notes">
              Notas del turno (opcional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={500}
              className="textarea"
              placeholder="Referencias, pedidos especiales, si viene con poco tiempo..."
            />
          </div>
        </section>

        <div className="space-y-4">
          <section className="card card-pad">
            <div className="flex items-center gap-2">
              <CalendarPlus className="size-4 text-copper" />
              <h2 className="font-semibold">Turno</h2>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="label" htmlFor="serviceId">
                  Servicio
                </label>
                <select
                  id="serviceId"
                  name="serviceId"
                  className="select"
                  required
                  defaultValue={services[0]?.id ?? ""}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.durationMin} min ·{" "}
                      {formatMoney(service.priceCents, shop.currency)}
                    </option>
                  ))}
                </select>
              </div>

              {user.role === "ADMIN" ? (
                <div>
                  <label className="label" htmlFor="barberId">
                    Barbero
                  </label>
                  <select
                    id="barberId"
                    name="barberId"
                    className="select"
                    required
                    defaultValue={defaultBarberId}
                  >
                    {barbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <input type="hidden" name="barberId" value={user.id} />
                  <div className="rounded-xl border border-line bg-sand/40 px-3.5 py-2.5 text-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                      Barbero
                    </p>
                    <p className="mt-0.5 font-medium">{user.name}</p>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="date">
                    Fecha
                  </label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    required
                    defaultValue={date}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="time">
                    Hora
                  </label>
                  <input
                    id="time"
                    name="time"
                    type="time"
                    required
                    defaultValue={time}
                    step={900}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="status">
                  Estado inicial
                </label>
                <select
                  id="status"
                  name="status"
                  className="select"
                  defaultValue="CONFIRMED"
                >
                  <option value="CONFIRMED">Confirmado</option>
                  <option value="PENDING">Pendiente</option>
                </select>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}
                Crear turno
              </button>
              <Link href="/panel/agenda" className="btn-secondary">
                Cancelar
              </Link>
            </div>
          </section>

          <div className="rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-stone-500">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Info className="size-4 text-copper" />
              Validación automática
            </p>
            <p className="mt-1.5">
              Al guardar, verificamos el horario de atención, la duración del
              servicio y que no se superponga con otro turno del barbero. Si
              hay un conflicto, te avisamos para que elijas otro horario.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
