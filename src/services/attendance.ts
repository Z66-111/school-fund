import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertStudentAccess, assertClassAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { parseDateOnly, isFuture, monthRange } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { holidayDates } from "@/services/holidays";
import { dateStringSchema } from "@/services/school-years";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor, AttendanceStatus } from "@/lib/roles";

export async function isMonthClosed(classId: string, year: number, month: number): Promise<boolean> {
  return (await prisma.monthClose.count({ where: { classId, year, month } })) > 0;
}

async function guardDate(classId: string, schoolYearId: string, date: Date, now: Date): Promise<void> {
  if (isFuture(date, now)) throw new AppError("FUTURE_DATE", mn.errors.futureDate);
  if (!isChargeable(date, await holidayDates(schoolYearId))) throw new AppError("NON_CHARGEABLE_DAY", mn.errors.nonChargeableDay);
  if (await isMonthClosed(classId, date.getUTCFullYear(), date.getUTCMonth() + 1)) throw new AppError("MONTH_CLOSED", mn.errors.monthClosed);
}

const toggleSchema = z.object({ studentId: z.string().min(1), date: dateStringSchema });

export async function toggleAttendance(actor: Actor, input: unknown, now: Date = new Date()): Promise<AttendanceStatus | null> {
  requireRole(actor, "TEACHER");
  const v = parse(toggleSchema, input);
  const { classId } = await assertStudentAccess(actor, v.studentId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const date = parseDateOnly(v.date);
  await guardDate(classId, klass.schoolYearId, date, now);

  const existing = await prisma.attendance.findUnique({ where: { studentId_date: { studentId: v.studentId, date } } });
  if (!existing) {
    await prisma.attendance.create({ data: { studentId: v.studentId, date, status: "PRESENT" } });
    return "PRESENT";
  }
  if (existing.status === "PRESENT") {
    await prisma.attendance.update({ where: { id: existing.id }, data: { status: "ABSENT" } });
    return "ABSENT";
  }
  await prisma.attendance.delete({ where: { id: existing.id } });
  return null;
}

const allSchema = z.object({ classId: z.string().min(1), date: dateStringSchema });

export async function markAllPresent(actor: Actor, input: unknown, now: Date = new Date()): Promise<number> {
  requireRole(actor, "TEACHER");
  const v = parse(allSchema, input);
  await assertClassAccess(actor, v.classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  const date = parseDateOnly(v.date);
  await guardDate(v.classId, klass.schoolYearId, date, now);
  const students = await prisma.student.findMany({ where: { classId: v.classId, isActive: true }, select: { id: true } });
  await prisma.$transaction(
    students.map((s) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: s.id, date } },
        update: { status: "PRESENT" },
        create: { studentId: s.id, date, status: "PRESENT" },
      }),
    ),
  );
  return students.length;
}

export function getMonthAttendance(classId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return prisma.attendance.findMany({
    where: { student: { classId }, date: { gte: start, lt: end } },
    select: { studentId: true, date: true, status: true },
  });
}
