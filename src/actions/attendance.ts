"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { saveAttendance, saveDaycare } from "@/services/attendance";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { AttendanceStatus } from "@/lib/roles";

export type AttendanceChange = { studentId: string; date: string; status: AttendanceStatus | null };

export async function saveAttendanceAction(classId: string, changes: AttendanceChange[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: mn.errors.loginRequired };
  try {
    await saveAttendance(actor, { classId, changes });
    revalidatePath(`/teacher/class/${classId}/attendance`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function saveDaycareAction(classId: string, changes: { studentId: string; date: string; present: boolean }[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: mn.errors.loginRequired };
  try {
    await saveDaycare(actor, { classId, changes });
    revalidatePath(`/teacher/class/${classId}/attendance`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
}
