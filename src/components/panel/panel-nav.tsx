"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CircleUser,
  LayoutDashboard,
  Scissors,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

const baseItems = [
  { href: "/panel", label: "Resumen", icon: LayoutDashboard },
  { href: "/panel/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/panel/citas", label: "Turnos", icon: CalendarClock },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/servicios", label: "Servicios", icon: Scissors },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
];

const adminItems = [
  { href: "/panel/barberos", label: "Barberos", icon: UserCog },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
];

const profileItem = {
  href: "/panel/perfil",
  label: "Mi perfil",
  icon: CircleUser,
};

export function PanelNav({
  role,
  variant = "sidebar",
}: {
  role: string;
  variant?: "sidebar" | "mobile";
}) {
  const pathname = usePathname();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const current =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  const items = [
    ...baseItems,
    ...(role === "ADMIN" ? adminItems : []),
    profileItem,
  ];

  const isActive = (href: string) =>
    href === "/panel" ? current === "/panel" : current.startsWith(href);

  if (variant === "mobile") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-3 py-2 scroll-thin">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-ink text-cream"
                  : "text-stone-500 hover:bg-sand hover:text-ink"
              }`}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-white/10 text-cream"
                : "text-cream/55 hover:bg-white/5 hover:text-cream"
            }`}
          >
            <item.icon
              className={`size-4 ${active ? "text-amber" : "text-cream/40"}`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
