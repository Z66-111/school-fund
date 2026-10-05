import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { fundBalance, allocateFoodPayments } from "@/lib/billing";
import { listExpenses } from "@/services/expenses";
import { isMonthClosed } from "@/services/attendance";
import { toCsv } from "@/lib/csv";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";
import type { Expense } from "@prisma/client";

export type FundReport = {
  className: string;
  annualFundAmount: number;
  collected: number;
  spent: number;
  balance: number;
  expenses: Expense[];
  contributions: { studentId: string; name: string; isActive: boolean; paid: number; due: number }[];
};

export async function classFundReport(actor: Actor, classId: string): Promise<FundReport> {
  await assertClassAccess(actor, classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const [students, sums, expenses] = await Promise.all([
    prisma.student.findMany({ where: { classId }, orderBy: { name: "asc" } }),
    prisma.payment.groupBy({ by: ["studentId"], where: { kind: "ANNUAL_FUND", deletedAt: null, student: { classId } }, _sum: { amount: true } }),
    listExpenses(actor, classId),
  ]);
  const paidBy = new Map(sums.map((s) => [s.studentId, s._sum.amount ?? 0]));
  const contributions = students.map((s) => {
    const paid = paidBy.get(s.id) ?? 0;
    return { studentId: s.id, name: s.name, isActive: s.isActive, paid, due: s.isActive ? Math.max(0, klass.annualFundAmount - paid) : 0 };
  });
  const collected = contributions.reduce((a, c) => a + c.paid, 0);
  const spent = expenses.reduce((a, e) => a + e.amount, 0);
  return { className: klass.name, annualFundAmount: klass.annualFundAmount, collected, spent, balance: fundBalance(collected, spent), expenses, contributions };
}

export type FoodReport = {
  className: string;
  year: number;
  month: number;
  closed: boolean;
  rows: { studentId: string; name: string; daysPresent: number; amount: number; paid: number; outstanding: number }[];
  totals: { amount: number; paid: number; outstanding: number };
};

export async function monthlyFoodReport(actor: Actor, classId: string, year: number, month: number): Promise<FoodReport> {
  requireRole(actor, "TEACHER", "ADMIN", "ACCOUNTANT");
  await assertClassAccess(actor, classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const invoices = await prisma.foodInvoice.findMany({
    where: { student: { classId } },
    include: { student: { select: { id: true, name: true } } },
  });
  const studentIds = [...new Set(invoices.map((i) => i.studentId))];
  const paidRows = await prisma.payment.groupBy({ by: ["studentId"], where: { kind: "FOOD", deletedAt: null, studentId: { in: studentIds } }, _sum: { amount: true } });
  const paidBy = new Map(paidRows.map((p) => [p.studentId, p._sum.amount ?? 0]));
  const rows: FoodReport["rows"] = [];
  for (const sid of studentIds) {
    const mine = invoices.filter((i) => i.studentId === sid);
    const allocated = allocateFoodPayments(mine, paidBy.get(sid) ?? 0);
    const inv = allocated.find((i) => i.year === year && i.month === month);
    if (!inv) continue;
    rows.push({ studentId: sid, name: inv.student.name, daysPresent: inv.daysPresent, amount: inv.amount, paid: inv.paid, outstanding: inv.outstanding });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const totals = rows.reduce((t, r) => ({ amount: t.amount + r.amount, paid: t.paid + r.paid, outstanding: t.outstanding + r.outstanding }), { amount: 0, paid: 0, outstanding: 0 });
  return { className: klass.name, year, month, closed: await isMonthClosed(classId, year, month), rows, totals };
}

export function fundReportCsv(r: FundReport): string {
  const rows: (string | number)[][] = [
    [mn.report.fund, r.className],
    [mn.report.collected, r.collected],
    [mn.report.spent, r.spent],
    [mn.report.balance, r.balance],
    [],
    [mn.report.contributions],
    [mn.common.student, mn.invoice.paid, mn.report.due],
    ...r.contributions.map((c) => [c.name, c.paid, c.due]),
    [],
    [mn.expense.title],
    [mn.common.date, mn.expense.itemTitle, mn.common.amount, mn.common.note],
    ...r.expenses.map((e) => [toISODate(e.date), e.title, e.amount, e.note]),
  ];
  return toCsv(rows);
}

export function foodReportCsv(r: FoodReport): string {
  return toCsv([
    [mn.report.food, r.className, `${r.year} ${mn.months[r.month - 1]}`],
    [mn.common.student, mn.attendance.daysPresent, mn.invoice.amount, mn.invoice.paid, mn.invoice.outstanding],
    ...r.rows.map((x) => [x.name, x.daysPresent, x.amount, x.paid, x.outstanding]),
    [mn.common.total, "", r.totals.amount, r.totals.paid, r.totals.outstanding],
  ]);
}
