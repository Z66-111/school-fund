"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { registerPayment, deletePayment } from "@/services/payments";

export async function registerPaymentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await registerPayment(actor, d);
    revalidatePath(`/accountant/students/${d.studentId}`);
    revalidatePath("/accountant");
  });
}
export async function deletePaymentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deletePayment(actor, d);
    revalidatePath("/accountant", "layout");
  });
}
