"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { toggleAttendance, markAllPresent, clearDay } from "@/services/attendance";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { runAction, type ActionResult } from "@/lib/action";
import type { AttendanceStatus } from "@/lib/roles";

export type ToggleResult = { ok: true; status: AttendanceStatus | null } | { ok: false; error: string };

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

export async function clearDayAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await clearDay(actor, d);
    revalidatePath(`/teacher/class/${d.classId}/attendance`);
  });
}

/** Marks every active student present on `date`, or clears that day when `present` is false. */
export async function setDayAction(classId: string, date: string, present: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: mn.errors.loginRequired };
  try {
    if (present) await markAllPresent(actor, { classId, date });
    else await clearDay(actor, { classId, date });
    revalidatePath(`/teacher/class/${classId}/attendance`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
}
