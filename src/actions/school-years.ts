"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createSchoolYear, activateSchoolYear } from "@/services/school-years";

export async function createSchoolYearAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createSchoolYear(actor, d);
    revalidatePath("/admin/school-years");
  });
}

export async function activateSchoolYearAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await activateSchoolYear(actor, d.id);
    revalidatePath("/admin", "layout");
  });
}
