"use server";

import { revalidatePath } from "next/cache";
import { createPublicBooking } from "@/lib/booking";
import { firstError, publicBookingSchema } from "@/lib/validation";

export async function createPublicBookingAction(input: unknown) {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: firstError(parsed.error) };
  }

  const result = await createPublicBooking(parsed.data);
  if (result.ok) {
    revalidatePath("/panel");
    revalidatePath("/panel/agenda");
    revalidatePath("/panel/citas");
  }
  return result;
}
