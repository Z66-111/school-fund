"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import readExcelFile from "read-excel-file/node";
import { saveAttendance, saveDaycare } from "@/services/attendance";
import { importAttendance, type SheetReport } from "@/services/attendance-import";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { localizeResult } from "@/lib/i18n/server";
import type { AttendanceStatus } from "@/lib/roles";

/** A failure whose message is shown in the viewer's language. */
const fail = (error: string) => localizeResult({ ok: false as const, error });

export type AttendanceChange = { studentId: string; date: string; status: AttendanceStatus | null };

export async function saveAttendanceAction(classId: string, changes: AttendanceChange[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getActor();
  if (!actor) return fail(mn.errors.loginRequired);
  try {
    await saveAttendance(actor, { classId, changes });
    revalidatePath(`/teacher/class/${classId}/attendance`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return fail(e.message);
    throw e;
  }
}

export async function saveDaycareAction(classId: string, changes: { studentId: string; date: string; present: boolean }[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = await getActor();
  if (!actor) return fail(mn.errors.loginRequired);
  try {
    await saveDaycare(actor, { classId, changes });
    revalidatePath(`/teacher/class/${classId}/attendance`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return fail(e.message);
    throw e;
  }
}

export type ImportAttendanceResult = { ok: true; report: SheetReport[] } | { ok: false; error: string };

const MAX_UPLOAD = 900 * 1024; // server actions accept 1MB in total

/** Reads the uploaded .xlsx and registers attendance from its month sheets. */
export async function importAttendanceAction(_p: ImportAttendanceResult | null, fd: FormData): Promise<ImportAttendanceResult> {
  const actor = await getActor();
  if (!actor) return fail(mn.errors.loginRequired);
  const classId = String(fd.get("classId") ?? "");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(mn.attendanceImport.fileRequired);
  if (file.size > MAX_UPLOAD) return fail(mn.attendanceImport.fileTooLarge);
  let sheets: { sheet: string; data: unknown[][] }[];
  try {
    sheets = await readExcelFile(Buffer.from(await file.arrayBuffer()));
  } catch {
    return fail(mn.attendanceImport.unreadable);
  }
  try {
    const report = await importAttendance(actor, classId, sheets);
    revalidatePath(`/teacher/class/${classId}/attendance`);
    return { ok: true, report };
  } catch (e) {
    if (e instanceof AppError) return fail(e.message);
    throw e;
  }
}
