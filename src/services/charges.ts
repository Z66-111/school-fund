import { prisma } from "@/lib/db";
import { openMonthCharges, type Charge } from "@/lib/billing";

export type StudentCharges = { food: Charge[]; daycare: Charge[] };

/**
 * Every food and daycare charge per student: frozen invoices of closed months plus a running
 * charge for each month still open (days so far × today's class rate), so balances grow daily. Food counts days
 * present in class; daycare counts days ticked on the separate Өдөр өнжүүлэх grid.
 */
export async function chargesFor(studentIds: string[]): Promise<Map<string, StudentCharges>> {
  const out = new Map<string, StudentCharges>(studentIds.map((id) => [id, { food: [], daycare: [] }]));
  if (studentIds.length === 0) return out;
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, isActive: true, class: { select: { id: true, schoolYearId: true, dailyFoodRate: true, dailyDaycareRate: true } } },
  });
  const classIds = [...new Set(students.map((s) => s.class.id))];
  const yearIds = [...new Set(students.map((s) => s.class.schoolYearId))];
  const [food, daycare, closes, present, daycareDays, holidays] = await Promise.all([
    prisma.foodInvoice.findMany({ where: { studentId: { in: studentIds } } }),
    prisma.daycareInvoice.findMany({ where: { studentId: { in: studentIds } } }),
    prisma.monthClose.findMany({ where: { classId: { in: classIds } }, select: { classId: true, year: true, month: true } }),
    prisma.attendance.findMany({ where: { studentId: { in: studentIds }, status: "PRESENT" }, select: { studentId: true, date: true, status: true } }),
    prisma.daycareAttendance.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, date: true } }),
    prisma.holiday.findMany({ where: { schoolYearId: { in: yearIds } }, select: { schoolYearId: true, date: true } }),
  ]);
  const frozen = (i: { id: string; year: number; month: number; daysPresent: number; rate: number; amount: number }): Charge =>
    ({ id: i.id, year: i.year, month: i.month, daysPresent: i.daysPresent, rate: i.rate, amount: i.amount, provisional: false });
  for (const i of food) out.get(i.studentId)!.food.push(frozen(i));
  for (const i of daycare) out.get(i.studentId)!.daycare.push(frozen(i));

  for (const s of students) {
    if (!s.isActive) continue; // closing a month skips inactive students, so the running charge does too
    const closed = new Set(closes.filter((c) => c.classId === s.class.id).map((c) => `${c.year}-${c.month}`));
    const rows = present.filter((r) => r.studentId === s.id);
    const hols = holidays.filter((h) => h.schoolYearId === s.class.schoolYearId).map((h) => h.date);
    const c = out.get(s.id)!;
    c.food.push(...openMonthCharges(rows, closed, hols, s.class.dailyFoodRate, "food"));
    const stayed = daycareDays.filter((r) => r.studentId === s.id).map((r) => ({ date: r.date, status: "PRESENT" }));
    c.daycare.push(...openMonthCharges(stayed, closed, hols, s.class.dailyDaycareRate, "daycare"));
  }
  return out;
}
