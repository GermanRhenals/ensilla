"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ExternalLink, Loader2, LogOut, Megaphone, Plus } from "lucide-react";
import { PanelNav } from "@/components/panel/panel-nav";
import { Logo } from "@/components/ui/logo";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { FALLBACK_SHOP, fetchShop, fetchUnreadCount } from "@/lib/data";
import { formatLongDate } from "@/lib/datetime";
import { initials } from "@/lib/format";
import type { Shop } from "@/lib/types";

function PanelShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, signOut } = useAuth();
  const [shop, setShop] = useState<Shop>(FALLBACK_SHOP);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchShop().then(setShop).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!loading && !profile) router.replace("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    fetchUnreadCount(profile.id).then(setUnread).catch(() => undefined);
  }, [profile, pathname]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f3ede3] text-stone-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const color = profile.color || "#c2703d";

  return (
    <div className="min-h-dvh bg-[#f3ede3] lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col bg-ink px-4 py-5 text-cream lg:flex">
        <Link href="/panel" className="px-2">
          <Logo className="text-cream" />
        </Link>

        <div className="mt-8 flex-1 overflow-y-auto scroll-thin">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/30">
            Operación
          </p>
          <PanelNav role={profile.role} />
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <Link
            href="/panel/perfil"
            className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/5"
          >
            <span
              className="flex size-9 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: `${color}33`, color }}
            >
              {initials(profile.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {profile.name}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-cream/40">
                {profile.role === "ADMIN" ? "Administrador" : "Barbero"}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.replace("/login");
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-cream/45 transition hover:bg-white/5 hover:text-cream"
          >
            <LogOut className="size-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="hidden lg:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                {shop.name}
              </p>
              <p className="font-display text-lg font-semibold capitalize">
                {formatLongDate(new Date(), shop.timezone)}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/panel/citas/nueva"
                className="btn-primary btn-sm hidden sm:inline-flex"
              >
                <Plus className="size-3.5" />
                Nueva cita
              </Link>
              <Link href="/" className="btn-ghost hidden md:inline-flex">
                <ExternalLink className="size-4" />
                Ver sitio
              </Link>
              <Link
                href="/panel/notificaciones"
                className="relative flex size-9 items-center justify-center rounded-full border border-line bg-white text-stone-500 transition hover:text-ink"
                aria-label="Notificaciones"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-copper text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link
                href="/panel/perfil"
                className="flex size-9 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: `${color}26`, color }}
                aria-label="Mi perfil"
              >
                {initials(profile.name)}
              </Link>
            </div>
          </div>
          <div className="border-t border-line lg:hidden">
            <PanelNav role={profile.role} variant="mobile" />
          </div>
        </header>

        {!shop.published && shop.id && (
          <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-1.5 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <p className="flex items-start gap-2">
                <Megaphone className="mt-0.5 size-4 shrink-0" />
                Tu barbería está en borrador: todavía no aparece en el buscador
                público.
              </p>
              <Link
                href="/panel/ajustes"
                className="font-semibold underline-offset-2 hover:underline"
              >
                Completar y publicar
              </Link>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PanelShell>{children}</PanelShell>
    </AuthProvider>
  );
}
