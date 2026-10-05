"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createClass, updateClassRates, assignTeacher } from "@/services/classes";

export async function createClassAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createClass(actor, d);
    revalidatePath("/admin/classes");
  });
}
export async function updateClassRatesAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await updateClassRates(actor, d.classId, d);
    revalidatePath(`/admin/classes/${d.classId}`);
  });
}
export async function assignTeacherAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await assignTeacher(actor, d.classId, d.teacherId || null);
    revalidatePath(`/admin/classes/${d.classId}`);
  });
}
