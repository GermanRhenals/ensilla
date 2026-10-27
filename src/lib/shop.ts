import { cache } from "react";
import { SHOP_TIMEZONE } from "./constants";
import { prisma } from "./prisma";

export type Shop = {
  name: string;
  tagline: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  currency: string;
  timezone: string;
  slotStepMin: number;
  bufferMin: number;
  leadTimeMin: number;
  bookingWindowDays: number;
};

const FALLBACK: Shop = {
  name: "En-silla Barbershop",
  tagline: "Cortes con memoria",
  description: null,
  address: null,
  phone: null,
  whatsapp: null,
  email: null,
  instagram: null,
  currency: "ARS",
  timezone: SHOP_TIMEZONE,
  slotStepMin: 15,
  bufferMin: 10,
  leadTimeMin: 60,
  bookingWindowDays: 21,
};

export const getShop = cache(async (): Promise<Shop> => {
  const setting = await prisma.shopSetting.findUnique({ where: { id: 1 } });
  if (!setting) return FALLBACK;
  return {
    name: setting.name,
    tagline: setting.tagline,
    description: setting.description,
    address: setting.address,
    phone: setting.phone,
    whatsapp: setting.whatsapp,
    email: setting.email,
    instagram: setting.instagram,
    currency: setting.currency,
    timezone: setting.timezone,
    slotStepMin: setting.slotStepMin,
    bufferMin: setting.bufferMin,
    leadTimeMin: setting.leadTimeMin,
    bookingWindowDays: setting.bookingWindowDays,
  };
});

export const getBusinessHours = cache(async () => {
  return prisma.businessHour.findMany({ orderBy: { weekday: "asc" } });
});

export async function getActiveBarbers() {
  return prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "BARBER"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      bio: true,
      color: true,
      phone: true,
    },
  });
}
