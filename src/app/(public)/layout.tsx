"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { FALLBACK_SHOP, fetchBusinessHours, fetchShop } from "@/lib/data";
import type { BusinessHour, Shop } from "@/lib/types";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<Shop>(FALLBACK_SHOP);
  const [hours, setHours] = useState<BusinessHour[]>([]);

  useEffect(() => {
    Promise.all([fetchShop(), fetchBusinessHours()])
      .then(([nextShop, nextHours]) => {
        setShop(nextShop);
        setHours(nextHours);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader shop={shop} />
      <main className="flex-1">{children}</main>
      <PublicFooter shop={shop} hours={hours} />
    </div>
  );
}
