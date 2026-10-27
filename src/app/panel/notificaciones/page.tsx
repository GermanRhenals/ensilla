"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Flash } from "@/components/ui/flash";
import { useAuth } from "@/lib/auth-context";
import {
  fetchNotifications,
  fetchShop,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/data";
import { formatDateTime } from "@/lib/datetime";
import { useAsync } from "@/lib/use-async";

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, reload } = useAsync(async () => {
    if (!profile) return null;
    const [shop, notifications] = await Promise.all([
      fetchShop(),
      fetchNotifications(profile.id),
    ]);
    return { shop, notifications };
  }, `notifications-${profile?.id ?? ""}`);

  if (!profile || !data) return null;
  const currentProfile = profile;
  const { shop, notifications } = data;
  const unread = notifications.filter((item) => !item.readAt).length;

  async function markAll() {
    setMessage(null);
    setError(null);
    try {
      await markAllNotificationsRead(currentProfile.id);
      setMessage("Marcaste todo como leído.");
      reload();
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "No se pudieron marcar los avisos.",
      );
    }
  }

  async function markOne(id: string) {
    setMessage(null);
    setError(null);
    try {
      await markNotificationRead(id);
      reload();
    } catch (markError) {
      setError(
        markError instanceof Error
          ? markError.message
          : "No se pudo marcar el aviso.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-copper">
            Notificaciones
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Lo que pasó mientras cortabas
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {unread > 0
              ? `Tenés ${unread} ${unread === 1 ? "aviso sin leer" : "avisos sin leer"}.`
              : "Estás al día. Sin avisos pendientes."}
          </p>
        </div>
        {unread > 0 && (
          <button type="button" onClick={markAll} className="btn-secondary">
            <CheckCheck className="size-4" />
            Marcar todo como leído
          </button>
        )}
      </div>

      <Flash ok={message ?? undefined} error={error ?? undefined} />

      <div className="card overflow-hidden">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-sand text-stone-400">
              <Bell className="size-5" />
            </span>
            <p className="mt-3 font-medium">No hay notificaciones todavía.</p>
            <p className="mt-1 max-w-sm text-sm text-stone-500">
              Cuando alguien reserve, cancele o pida un turno, vas a enterarte
              acá.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {notifications.map((notification) => {
              const isUnread = !notification.readAt;
              return (
                <div
                  key={notification.id}
                  className={`flex gap-3 px-4 py-4 transition ${
                    isUnread ? "bg-copper/[0.04]" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                      isUnread
                        ? "bg-copper/10 text-copper"
                        : "bg-sand text-stone-400"
                    }`}
                  >
                    <Bell className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">
                        {notification.title}
                      </p>
                      {isUnread && (
                        <span className="size-1.5 rounded-full bg-copper" />
                      )}
                    </div>
                    {notification.body && (
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">
                        {notification.body}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                      <span>
                        {formatDateTime(
                          new Date(notification.createdAt),
                          shop.timezone,
                        )}
                      </span>
                      {notification.href &&
                        notification.href.startsWith("/panel") && (
                          <Link
                            href={notification.href}
                            className="inline-flex items-center gap-1 font-medium text-copper transition hover:underline"
                          >
                            Abrir
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markOne(notification.id)}
                      className="flex size-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-sand hover:text-ink"
                      title="Marcar como leída"
                    >
                      <Check className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
