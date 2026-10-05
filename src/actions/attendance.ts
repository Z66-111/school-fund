"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { toggleAttendance, markAllPresent } from "@/services/attendance";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { runAction, type ActionResult } from "@/lib/action";

export type ToggleResult = { ok: true; status: "PRESENT" | "ABSENT" | null } | { ok: false; error: string };

export async function toggleAttendanceAction(studentId: string, date: string): Promise<ToggleResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: mn.errors.loginRequired };
  try {
    const status = await toggleAttendance(actor, { studentId, date });
    return { ok: true, status };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function markAllPresentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await markAllPresent(actor, d);
    revalidatePath(`/teacher/class/${d.classId}/attendance`);
  });
}
