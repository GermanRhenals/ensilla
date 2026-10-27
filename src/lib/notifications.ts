import { prisma } from "./prisma";

export async function notify({
  userId,
  title,
  body,
  href,
}: {
  userId: string;
  title: string;
  body?: string;
  href?: string;
}) {
  return prisma.notification.create({
    data: { userId, title, body, href },
  });
}

export async function unreadNotifications(userId: string) {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}
