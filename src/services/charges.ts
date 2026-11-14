import { prisma } from "@/lib/db";
import { todayDate } from "@/lib/dates";
import { openMonthCharges, daycareCharges, type Charge } from "@/lib/billing";

export type StudentCharges = { food: Charge[]; daycare: Charge[] };

/**
 * Every food and daycare charge per student: frozen invoices of closed months plus a charge for
 * each month still open.
 *
 * Food is pay-as-you-go: days present so far × today's class rate, so the balance grows daily.
 * Өдөр өнжүүлэх is prepaid: an enrolled child owes the whole month from its first day, less the
 * days skipped in the month before (see `daycareCharges`).
 */
export async function chargesFor(studentIds: string[], now: Date = new Date()): Promise<Map<string, StudentCharges>> {
  const out = new Map<string, StudentCharges>(studentIds.map((id) => [id, { food: [], daycare: [] }]));
  if (studentIds.length === 0) return out;
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      isActive: true,
      daycareFrom: true,
      daycareUntil: true,
      class: { select: { id: true, schoolYearId: true, dailyFoodRate: true, dailyDaycareRate: true, schoolYear: { select: { startDate: true, endDate: true } } } },
    },
  });
  const classIds = [...new Set(students.map((s) => s.class.id))];
  const yearIds = [...new Set(students.map((s) => s.class.schoolYearId))];
  const [food, daycare, closes, present, skips, holidays] = await Promise.all([
    prisma.foodInvoice.findMany({ where: { studentId: { in: studentIds } } }),
    prisma.daycareInvoice.findMany({ where: { studentId: { in: studentIds } } }),
    prisma.monthClose.findMany({ where: { classId: { in: classIds } }, select: { classId: true, year: true, month: true } }),
    prisma.attendance.findMany({ where: { studentId: { in: studentIds }, status: "PRESENT" }, select: { studentId: true, date: true, status: true } }),
    prisma.daycareSkip.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, date: true } }),
    prisma.holiday.findMany({ where: { schoolYearId: { in: yearIds } }, select: { schoolYearId: true, date: true } }),
  ]);
  const frozen = (i: { id: string; year: number; month: number; daysPresent: number; rate: number; amount: number; deductedDays?: number }): Charge =>
    ({ id: i.id, year: i.year, month: i.month, daysPresent: i.daysPresent, rate: i.rate, amount: i.amount, provisional: false, ...(i.deductedDays === undefined ? {} : { deductedDays: i.deductedDays }) });
  for (const i of food) out.get(i.studentId)!.food.push(frozen(i));
  for (const i of daycare) out.get(i.studentId)!.daycare.push(frozen(i));

  const today = todayDate(now);
  for (const s of students) {
    if (!s.isActive) continue; // closing a month skips inactive students, so the open-month charges do too
    const closed = new Set(closes.filter((c) => c.classId === s.class.id).map((c) => `${c.year}-${c.month}`));
    const rows = present.filter((r) => r.studentId === s.id);
    const hols = holidays.filter((h) => h.schoolYearId === s.class.schoolYearId).map((h) => h.date);
    const c = out.get(s.id)!;
    c.food.push(...openMonthCharges(rows, closed, hols, s.class.dailyFoodRate, "food"));
    if (s.daycareFrom) {
      c.daycare = daycareCharges({
        from: s.daycareFrom,
        until: s.daycareUntil,
        yearStart: s.class.schoolYear.startDate,
        yearEnd: s.class.schoolYear.endDate,
        today,
        holidays: hols,
        skips: skips.filter((r) => r.studentId === s.id).map((r) => r.date),
        rate: s.class.dailyDaycareRate,
        closedMonths: closed,
        frozen: c.daycare,
      });
    }
  }
  return out;
}
