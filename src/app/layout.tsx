import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "En-silla · Barbería con memoria",
    template: "%s · En-silla",
  },
  description:
    "Reservá tu turno, organizá la agenda de tu barbería y anticipá las preferencias de cada cliente en un solo lugar.",
  applicationName: "En-silla",
};

export const viewport: Viewport = {
  themeColor: "#18120f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
