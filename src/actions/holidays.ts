"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { addHoliday, deleteHoliday } from "@/services/holidays";

export async function addHolidayAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await addHoliday(actor, d);
    revalidatePath("/admin/holidays");
  });
}

export async function deleteHolidayAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deleteHoliday(actor, d.id);
    revalidatePath("/admin/holidays");
  });
}
