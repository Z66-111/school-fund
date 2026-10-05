import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export const WEEKDAYS = 5;
export const PERIODS = 8;

export type Schedule = {
  periods: { period: number; startTime: string | null; endTime: string | null }[];
  slots: Record<string, { subject: string; note: string }>;
};

export const slotKey = (weekday: number, period: number) => `${weekday}-${period}`;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Accepts "H:MM" as well as "HH:MM"; stores zero-padded. */
const timeSchema = z
  .string()
  .trim()
  .transform((v) => (/^\d:\d\d$/.test(v) ? `0${v}` : v))
  .refine((v) => v === "" || TIME.test(v), { message: mn.errors.invalidTime });
const textSchema = (max: number) => z.string().trim().max(max, mn.errors.validation);

export async function getSchedule(actor: Actor, classId: string): Promise<Schedule> {
  await assertClassAccess(actor, classId);
  const [slots, times] = await Promise.all([
    prisma.lessonSlot.findMany({ where: { classId } }),
    prisma.periodTime.findMany({ where: { classId } }),
  ]);
  const byPeriod = new Map(times.map((t) => [t.period, t]));
  return {
    periods: Array.from({ length: PERIODS }, (_, i) => {
      const t = byPeriod.get(i + 1);
      return { period: i + 1, startTime: t?.startTime ?? null, endTime: t?.endTime ?? null };
    }),
    slots: Object.fromEntries(slots.map((s) => [slotKey(s.weekday, s.period), { subject: s.subject, note: s.note }])),
  };
}

/** Replace-all save of a class timetable from the flat form object. */
export async function saveSchedule(actor: Actor, classId: string, input: Record<string, string>): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  if (!classId) throw new NotFoundError(); // never let an empty id reach the replace-all deleteMany
  await assertClassAccess(actor, classId);

  const fieldErrors: Record<string, string[]> = {};
  const fail = (key: string, msg: string) => (fieldErrors[key] ??= []).push(msg);

  const slots: { weekday: number; period: number; subject: string; note: string }[] = [];
  for (let w = 1; w <= WEEKDAYS; w++) {
    for (let p = 1; p <= PERIODS; p++) {
      const subj = textSchema(60).safeParse(input[`s-${w}-${p}`] ?? "");
      const note = textSchema(60).safeParse(input[`n-${w}-${p}`] ?? "");
      if (!subj.success) { fail(`s-${w}-${p}`, mn.errors.validation); continue; }
      if (!note.success) { fail(`n-${w}-${p}`, mn.errors.validation); continue; }
      if (subj.data) slots.push({ weekday: w, period: p, subject: subj.data, note: note.data });
    }
  }

  const times: { period: number; startTime: string | null; endTime: string | null }[] = [];
  for (let p = 1; p <= PERIODS; p++) {
    const start = timeSchema.safeParse(input[`start-${p}`] ?? "");
    const end = timeSchema.safeParse(input[`end-${p}`] ?? "");
    if (!start.success) fail(`start-${p}`, mn.errors.invalidTime);
    if (!end.success) fail(`end-${p}`, mn.errors.invalidTime);
    if (!start.success || !end.success) continue;
    if (start.data && end.data && end.data <= start.data) { fail(`end-${p}`, mn.errors.endBeforeStart); continue; }
    if (start.data || end.data) times.push({ period: p, startTime: start.data || null, endTime: end.data || null });
  }

  if (Object.keys(fieldErrors).length) throw new ValidationError(fieldErrors);

  await prisma.$transaction([
    prisma.lessonSlot.deleteMany({ where: { classId } }),
    prisma.periodTime.deleteMany({ where: { classId } }),
    ...slots.map((s) => prisma.lessonSlot.create({ data: { classId, ...s } })),
    ...times.map((t) => prisma.periodTime.create({ data: { classId, ...t } })),
  ]);
}
