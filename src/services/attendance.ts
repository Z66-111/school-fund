import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { parseDateOnly, isFuture, monthRange } from "@/lib/dates";
import { isChargeable, isEnrolledOn } from "@/lib/billing";
import { holidayDates } from "@/services/holidays";
import { dateStringSchema } from "@/services/school-years";
import { AppError, ForbiddenError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { ATTENDANCE_STATUSES, type Actor } from "@/lib/roles";

export async function isMonthClosed(classId: string, year: number, month: number): Promise<boolean> {
  return (await prisma.monthClose.count({ where: { classId, year, month } })) > 0;
}

async function guardDate(classId: string, schoolYearId: string, date: Date, now: Date): Promise<void> {
  if (isFuture(date, now)) throw new AppError("FUTURE_DATE", mn.errors.futureDate);
  if (!isChargeable(date, await holidayDates(schoolYearId))) throw new AppError("NON_CHARGEABLE_DAY", mn.errors.nonChargeableDay);
  if (await isMonthClosed(classId, date.getUTCFullYear(), date.getUTCMonth() + 1)) throw new AppError("MONTH_CLOSED", mn.errors.monthClosed);
}

const saveSchema = z.object({
  classId: z.string().min(1),
  changes: z
    .array(z.object({ studentId: z.string().min(1), date: dateStringSchema, status: z.enum(ATTENDANCE_STATUSES).nullable() }))
    .min(1)
    .max(5000),
});

/** Applies a batch of grid edits in one transaction; `status: null` clears the mark. Every date is checked first, so a bad cell saves nothing. */
export async function saveAttendance(actor: Actor, input: unknown, now: Date = new Date()): Promise<number> {
  requireRole(actor, "TEACHER");
  const v = parse(saveSchema, input);
  await assertClassAccess(actor, v.classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  const ids = [...new Set(v.changes.map((c) => c.studentId))];
  const inClass = await prisma.student.count({ where: { id: { in: ids }, classId: v.classId } });
  if (inClass !== ids.length) throw new ForbiddenError();
  for (const iso of new Set(v.changes.map((c) => c.date))) await guardDate(v.classId, klass.schoolYearId, parseDateOnly(iso), now);
  await prisma.$transaction(
    v.changes.map((c) => {
      const date = parseDateOnly(c.date);
      return c.status
        ? prisma.attendance.upsert({
            where: { studentId_date: { studentId: c.studentId, date } },
            update: { status: c.status },
            create: { studentId: c.studentId, date, status: c.status },
          })
        : prisma.attendance.deleteMany({ where: { studentId: c.studentId, date } });
    }),
  );
  return v.changes.length;
}

const daycareSchema = z.object({
  classId: z.string().min(1),
  changes: z.array(z.object({ studentId: z.string().min(1), date: dateStringSchema, present: z.boolean() })).min(1).max(5000),
});

/**
 * Same date rules as saveAttendance, for the Өдөр өнжүүлэх grid. An enrolled child is taken to have
 * stayed every school day, so only the exceptions are stored: `present: false` records a skipped
 * day, `present: true` removes it. Days outside the child's enrolment window are rejected.
 */
export async function saveDaycare(actor: Actor, input: unknown, now: Date = new Date()): Promise<number> {
  requireRole(actor, "TEACHER");
  const v = parse(daycareSchema, input);
  await assertClassAccess(actor, v.classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  const ids = [...new Set(v.changes.map((c) => c.studentId))];
  const students = await prisma.student.findMany({ where: { id: { in: ids }, classId: v.classId }, select: { id: true, daycareFrom: true, daycareUntil: true } });
  if (students.length !== ids.length) throw new ForbiddenError();
  for (const iso of new Set(v.changes.map((c) => c.date))) await guardDate(v.classId, klass.schoolYearId, parseDateOnly(iso), now);
  const byId = new Map(students.map((s) => [s.id, s]));
  for (const c of v.changes) {
    const s = byId.get(c.studentId)!;
    if (!isEnrolledOn(parseDateOnly(c.date), s.daycareFrom, s.daycareUntil)) throw new AppError("NOT_ENROLLED", mn.errors.daycareNotEnrolled);
  }
  await prisma.$transaction(
    v.changes.map((c) => {
      const date = parseDateOnly(c.date);
      return c.present
        ? prisma.daycareSkip.deleteMany({ where: { studentId: c.studentId, date } })
        : prisma.daycareSkip.upsert({ where: { studentId_date: { studentId: c.studentId, date } }, update: {}, create: { studentId: c.studentId, date } });
    }),
  );
  return v.changes.length;
}

/** The skipped Өдөр өнжүүлэх days of a class in one month. */
export function getMonthDaycareSkips(classId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return prisma.daycareSkip.findMany({
    where: { student: { classId }, date: { gte: start, lt: end } },
    select: { studentId: true, date: true },
  });
}

export function getMonthAttendance(classId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return prisma.attendance.findMany({
    where: { student: { classId }, date: { gte: start, lt: end } },
    select: { studentId: true, date: true, status: true },
  });
}
