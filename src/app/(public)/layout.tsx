import type { ReactNode } from "react";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { getBusinessHours, getShop } from "@/lib/shop";

export const dynamic = "force-dynamic";

export default async function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [shop, hours] = await Promise.all([getShop(), getBusinessHours()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader shop={shop} />
      <main className="flex-1">{children}</main>
      <PublicFooter shop={shop} hours={hours} />
    </div>
  );
}
