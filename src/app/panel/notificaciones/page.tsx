import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { Flash } from "@/components/ui/flash";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { getShop } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Notificaciones",
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const [shop, notifications] = await Promise.all([
    getShop(),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  const unread = notifications.filter((item) => !item.readAt).length;

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
          <form action={markAllNotificationsReadAction}>
            <input
              type="hidden"
              name="redirectTo"
              value="/panel/notificaciones"
            />
            <button type="submit" className="btn-secondary">
              <CheckCheck className="size-4" />
              Marcar todo como leído
            </button>
          </form>
        )}
      </div>

      <Flash ok={params.ok} error={params.error} />

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
                          notification.createdAt,
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
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="id" value={notification.id} />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value="/panel/notificaciones"
                      />
                      <button
                        type="submit"
                        className="flex size-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-sand hover:text-ink"
                        title="Marcar como leída"
                      >
                        <Check className="size-4" />
                      </button>
                    </form>
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
