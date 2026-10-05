"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { closeMonth, reopenMonth } from "@/services/month-close";

export async function closeMonthAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await closeMonth(actor, d);
    revalidatePath(`/teacher/class/${d.classId}`, "layout");
  });
}
export async function reopenMonthAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await reopenMonth(actor, d);
    revalidatePath(`/admin/classes/${d.classId}/months`);
  });
}
