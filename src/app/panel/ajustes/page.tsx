import type { Metadata } from "next";
import { Clock3, Globe2, Save, Store } from "lucide-react";
import { updateHoursAction, updateShopAction } from "@/app/actions/settings";
import { Flash } from "@/components/ui/flash";
import { requireAdmin } from "@/lib/auth";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { minutesToTime } from "@/lib/datetime";
import { getBusinessHours, getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Ajustes",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  await requireAdmin();
  const [shop, hours] = await Promise.all([getShop(), getBusinessHours()]);

  const byWeekday = new Map(hours.map((hour) => [hour.weekday, hour]));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
          Ajustes
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          La casa por dentro
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Datos del local, horarios de atención y reglas de la agenda.
        </p>
      </div>

      <Flash ok={params.ok} error={params.error} />

      <div className="grid items-start gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <form action={updateShopAction} className="card card-pad space-y-4">
          <div className="flex items-center gap-2">
            <Store className="size-4 text-copper" />
            <h2 className="font-semibold">Datos del local</h2>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={shop.name}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="tagline">
                Lema
              </label>
              <input
                id="tagline"
                name="tagline"
                required
                minLength={2}
                maxLength={120}
                defaultValue={shop.tagline}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="description">
                Descripción
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                maxLength={600}
                defaultValue={shop.description ?? ""}
                className="textarea"
                placeholder="Cómo es la experiencia en la barbería..."
              />
            </div>
            <div>
              <label className="label" htmlFor="address">
                Dirección
              </label>
              <input
                id="address"
                name="address"
                maxLength={200}
                defaultValue={shop.address ?? ""}
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
                maxLength={40}
                defaultValue={shop.phone ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="whatsapp">
                WhatsApp
              </label>
              <input
                id="whatsapp"
                name="whatsapp"
                maxLength={40}
                defaultValue={shop.whatsapp ?? ""}
                className="input"
                placeholder="+54 9 11 ..."
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
                maxLength={160}
                defaultValue={shop.email ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="instagram">
                Instagram
              </label>
              <input
                id="instagram"
                name="instagram"
                maxLength={80}
                defaultValue={shop.instagram ?? ""}
                className="input"
                placeholder="@ensilla"
              />
            </div>
            <div>
              <label className="label" htmlFor="currency">
                Moneda
              </label>
              <input
                id="currency"
                name="currency"
                required
                minLength={2}
                maxLength={6}
                defaultValue={shop.currency}
                className="input"
              />
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-copper" />
              <h2 className="font-semibold">Agenda y reservas online</h2>
            </div>

            <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="timezone">
                  Zona horaria (IANA)
                </label>
                <input
                  id="timezone"
                  name="timezone"
                  required
                  minLength={3}
                  maxLength={80}
                  defaultValue={shop.timezone}
                  className="input"
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  Ej: America/Argentina/Buenos_Aires, America/Santiago,
                  Europe/Madrid.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="slotStepMin">
                  Intervalo entre turnos (min)
                </label>
                <input
                  id="slotStepMin"
                  name="slotStepMin"
                  type="number"
                  min={5}
                  max={60}
                  step={5}
                  required
                  defaultValue={shop.slotStepMin}
                  className="input"
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  Cada cuántos minutos se ofrecen horarios.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="bufferMin">
                  Descanso entre turnos (min)
                </label>
                <input
                  id="bufferMin"
                  name="bufferMin"
                  type="number"
                  min={0}
                  max={120}
                  step={5}
                  required
                  defaultValue={shop.bufferMin}
                  className="input"
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  Margen para limpiar y preparar el puesto.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="leadTimeMin">
                  Anticipación mínima (min)
                </label>
                <input
                  id="leadTimeMin"
                  name="leadTimeMin"
                  type="number"
                  min={0}
                  max={1440}
                  step={15}
                  required
                  defaultValue={shop.leadTimeMin}
                  className="input"
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  Con cuánta anticipación se puede reservar hoy.
                </p>
              </div>
              <div>
                <label className="label" htmlFor="bookingWindowDays">
                  Reservas a futuro (días)
                </label>
                <input
                  id="bookingWindowDays"
                  name="bookingWindowDays"
                  type="number"
                  min={1}
                  max={120}
                  required
                  defaultValue={shop.bookingWindowDays}
                  className="input"
                />
                <p className="mt-1 text-[11px] text-stone-400">
                  Hasta cuántos días adelante se puede reservar.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" className="btn-primary">
              <Save className="size-4" />
              Guardar configuración
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <form action={updateHoursAction} className="card card-pad">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-copper" />
              <h2 className="font-semibold">Horario de atención</h2>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Los días destildados no muestran turnos online ni en el panel.
            </p>

            <div className="mt-4 space-y-2">
              {WEEKDAY_LABELS.map((label, weekday) => {
                const hour = byWeekday.get(weekday);
                return (
                  <div
                    key={weekday}
                    className="grid grid-cols-[92px_1fr_1fr] items-center gap-2 rounded-xl px-2 py-1.5 odd:bg-sand/40"
                  >
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        name={`active-${weekday}`}
                        defaultChecked={hour?.active ?? false}
                        className="size-3.5 accent-copper"
                      />
                      {label}
                    </label>
                    <input
                      type="time"
                      name={`open-${weekday}`}
                      defaultValue={minutesToTime(hour?.openMinute ?? 600)}
                      className="input h-8 px-2 py-0 text-xs"
                    />
                    <input
                      type="time"
                      name={`close-${weekday}`}
                      defaultValue={minutesToTime(hour?.closeMinute ?? 1200)}
                      className="input h-8 px-2 py-0 text-xs"
                    />
                  </div>
                );
              })}
            </div>

            <button type="submit" className="btn-primary mt-4 w-full">
              <Save className="size-4" />
              Guardar horarios
            </button>
          </form>

          <div className="rounded-2xl border border-line bg-white p-4 text-xs leading-relaxed text-stone-500">
            <p className="text-sm font-semibold text-ink">Cómo se arma la agenda</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4">
              <li>
                Se parte del horario de atención del día y se descartan los
                turnos ya tomados de cada barbero.
              </li>
              <li>
                Se aplica el margen de {shop.bufferMin} min entre turnos y la
                anticipación mínima de {shop.leadTimeMin} min para hoy.
              </li>
              <li>
                Solo se ofrecen horarios dentro de los próximos{" "}
                {shop.bookingWindowDays} días.
              </li>
            </ol>
            <p className="mt-2">
              Si cambiás la zona horaria, los turnos existentes se reinterpretan
              en la nueva zona.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
