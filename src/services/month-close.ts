import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { isFutureMonth } from "@/lib/dates";
import { countPresentDays, invoiceAmount } from "@/lib/billing";
import { holidayDates } from "@/services/holidays";
import { getMonthAttendance, getMonthDaycare, isMonthClosed } from "@/services/attendance";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export const monthSchema = z.object({
  classId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function closeMonth(actor: Actor, input: unknown, now: Date = new Date()): Promise<{ invoices: number }> {
  requireRole(actor, "TEACHER");
  const v = parse(monthSchema, input);
  await assertClassAccess(actor, v.classId);
  if (isFutureMonth(v.year, v.month, now)) throw new AppError("FUTURE_MONTH", mn.errors.futureMonth);
  if (await isMonthClosed(v.classId, v.year, v.month)) throw new AppError("MONTH_ALREADY_CLOSED", mn.errors.monthAlreadyClosed);

  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  const [students, rows, daycareRows, holidays] = await Promise.all([
    prisma.student.findMany({ where: { classId: v.classId, isActive: true }, select: { id: true } }),
    getMonthAttendance(v.classId, v.year, v.month),
    getMonthDaycare(v.classId, v.year, v.month),
    holidayDates(klass.schoolYearId),
  ]);

  await prisma.$transaction(async (tx) => {
    const close = await tx.monthClose.create({
      data: { classId: v.classId, year: v.year, month: v.month, closedById: actor.userId },
    });
    for (const s of students) {
      const daysPresent = countPresentDays(rows.filter((r) => r.studentId === s.id), v.year, v.month, holidays);
      await tx.foodInvoice.create({
        data: {
          studentId: s.id,
          monthCloseId: close.id,
          year: v.year,
          month: v.month,
          daysPresent,
          rate: klass.dailyFoodRate,
          amount: invoiceAmount(daysPresent, klass.dailyFoodRate),
        },
      });
      const daycareDays = countPresentDays(daycareRows.filter((r) => r.studentId === s.id).map((r) => ({ date: r.date, status: "PRESENT" })), v.year, v.month, holidays);
      if (daycareDays > 0) {
        await tx.daycareInvoice.create({
          data: {
            studentId: s.id,
            monthCloseId: close.id,
            year: v.year,
            month: v.month,
            daysPresent: daycareDays,
            rate: klass.dailyDaycareRate,
            amount: invoiceAmount(daycareDays, klass.dailyDaycareRate),
          },
        });
      }
    }
  });
  return { invoices: students.length };
}

export async function reopenMonth(actor: Actor, input: unknown): Promise<void> {
  requireRole(actor, "ADMIN");
  const v = parse(monthSchema, input);
  const close = await prisma.monthClose.findUnique({
    where: { classId_year_month: { classId: v.classId, year: v.year, month: v.month } },
  });
  if (!close) throw new AppError("MONTH_NOT_CLOSED", mn.errors.monthNotClosed);
  const later = await prisma.payment.count({
    where: { kind: { in: ["FOOD", "DAYCARE"] }, deletedAt: null, createdAt: { gt: close.closedAt }, student: { classId: v.classId } },
  });
  if (later > 0) throw new AppError("REOPEN_BLOCKED", mn.errors.reopenBlocked);
  await prisma.$transaction([
    prisma.foodInvoice.deleteMany({ where: { monthCloseId: close.id } }),
    prisma.daycareInvoice.deleteMany({ where: { monthCloseId: close.id } }),
    prisma.monthClose.delete({ where: { id: close.id } }),
  ]);
}

export function listMonthCloses(classId: string) {
  return prisma.monthClose.findMany({ where: { classId }, orderBy: [{ year: "asc" }, { month: "asc" }], include: { closedBy: { select: { name: true } } } });
}
