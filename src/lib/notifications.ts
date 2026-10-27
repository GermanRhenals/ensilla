import { fetchUnreadCount } from "./data";
import { supabase } from "./supabase";

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
  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id: userId, title, body: body ?? null, href: href ?? null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function unreadNotifications(userId: string) {
  return fetchUnreadCount(userId);
}
