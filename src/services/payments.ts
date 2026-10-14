import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertStudentAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { moneySchema } from "@/lib/money";
import { parseDateOnly, isFuture } from "@/lib/dates";
import { allocateFoodPayments, foodOutstanding, foodCredit, type Charge } from "@/lib/billing";
import { chargesFor } from "@/services/charges";
import { dateStringSchema } from "@/services/school-years";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { PAYMENT_KINDS, type Actor } from "@/lib/roles";

const registerSchema = z.object({
  studentId: z.string().min(1),
  kind: z.enum(PAYMENT_KINDS),
  amount: moneySchema,
  paidAt: dateStringSchema,
  note: z.string().trim().max(500).optional().default(""),
});

export async function registerPayment(actor: Actor, input: unknown, now: Date = new Date()) {
  requireRole(actor, "ACCOUNTANT");
  const v = parse(registerSchema, input);
  await assertStudentAccess(actor, v.studentId);
  const paidAt = parseDateOnly(v.paidAt);
  if (isFuture(paidAt, now)) throw new AppError("FUTURE_DATE", mn.errors.futureDate);
  return prisma.payment.create({
    data: { studentId: v.studentId, kind: v.kind, amount: v.amount, paidAt, note: v.note, registeredById: actor.userId },
  });
}

const deleteSchema = z.object({ paymentId: z.string().min(1), reason: z.string().trim().min(1, mn.errors.required) });

export async function deletePayment(actor: Actor, input: unknown): Promise<void> {
  requireRole(actor, "ACCOUNTANT");
  const v = parse(deleteSchema, input);
  const p = await prisma.payment.findUnique({ where: { id: v.paymentId } });
  if (!p || p.deletedAt) throw new AppError("NOT_FOUND", mn.errors.notFound);
  if (p.registeredById !== actor.userId) throw new AppError("NOT_OWN_PAYMENT", mn.errors.notOwnPayment);
  await prisma.payment.update({ where: { id: p.id }, data: { deletedAt: new Date(), deleteReason: v.reason } });
}

export async function listPayments(actor: Actor, studentId: string) {
  await assertStudentAccess(actor, studentId);
  return prisma.payment.findMany({
    where: { studentId, deletedAt: null },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: { registeredBy: { select: { name: true } } },
  });
}

export function listAllPayments(actor: Actor) {
  requireRole(actor, "ACCOUNTANT", "ADMIN");
  return prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { student: { select: { name: true, class: { select: { name: true } } } }, registeredBy: { select: { name: true } } },
  });
}

export type StudentBalances = {
  annualFundAmount: number;
  fundPaid: number;
  fundDue: number;
  invoices: (Charge & { paid: number; outstanding: number })[];
  foodInvoiced: number;
  foodPaid: number;
  foodOutstanding: number;
  foodCredit: number;
  daycareInvoices: (Charge & { paid: number; outstanding: number })[];
  daycareInvoiced: number;
  daycarePaid: number;
  daycareOutstanding: number;
  daycareCredit: number;
};

export async function studentBalances(actor: Actor, studentId: string): Promise<StudentBalances> {
  await assertStudentAccess(actor, studentId);
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { class: true } });
  const [charges, sums] = await Promise.all([
    chargesFor([studentId]),
    prisma.payment.groupBy({ by: ["kind"], where: { studentId, deletedAt: null }, _sum: { amount: true } }),
  ]);
  const { food: invoices, daycare: daycareInvoices } = charges.get(studentId)!;
  const paidOf = (kind: string) => sums.find((s) => s.kind === kind)?._sum.amount ?? 0;
  const foodPaid = paidOf("FOOD");
  const fundPaid = paidOf("ANNUAL_FUND");
  const foodInvoiced = invoices.reduce((a, i) => a + i.amount, 0);
  const daycarePaid = paidOf("DAYCARE");
  const daycareInvoiced = daycareInvoices.reduce((a, i) => a + i.amount, 0);
  return {
    annualFundAmount: student.class.annualFundAmount,
    fundPaid,
    fundDue: student.isActive ? Math.max(0, student.class.annualFundAmount - fundPaid) : 0,
    invoices: allocateFoodPayments(invoices, foodPaid),
    foodInvoiced,
    foodPaid,
    foodOutstanding: foodOutstanding(foodInvoiced, foodPaid),
    foodCredit: foodCredit(foodInvoiced, foodPaid),
    daycareInvoices: allocateFoodPayments(daycareInvoices, daycarePaid),
    daycareInvoiced,
    daycarePaid,
    daycareOutstanding: foodOutstanding(daycareInvoiced, daycarePaid),
    daycareCredit: foodCredit(daycareInvoiced, daycarePaid),
  };
}

export type OutstandingRow = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  schoolYearName: string;
  isActiveYear: boolean;
  isActive: boolean;
  foodDue: number;
  daycareDue: number;
  fundDue: number;
};

export async function outstandingTable(actor: Actor, classId?: string): Promise<OutstandingRow[]> {
  requireRole(actor, "ACCOUNTANT", "ADMIN");
  const students = await prisma.student.findMany({
    where: classId ? { classId } : {},
    include: {
      class: { select: { id: true, name: true, annualFundAmount: true, schoolYear: { select: { name: true, isActive: true } } } },
    },
    orderBy: [{ class: { schoolYear: { startDate: "desc" } } }, { class: { name: "asc" } }, { name: "asc" }],
  });
  const ids = students.map((s) => s.id);
  const [charges, pay] = await Promise.all([
    chargesFor(ids),
    prisma.payment.groupBy({ by: ["studentId", "kind"], where: { studentId: { in: ids }, deletedAt: null }, _sum: { amount: true } }),
  ]);
  const sum = (cs: Charge[]) => cs.reduce((a, c) => a + c.amount, 0);
  const invoiced = new Map(ids.map((id) => [id, sum(charges.get(id)!.food)]));
  const daycareInvoiced = new Map(ids.map((id) => [id, sum(charges.get(id)!.daycare)]));
  const paid = new Map(pay.map((r) => [`${r.studentId}|${r.kind}`, r._sum.amount ?? 0]));
  const rows: OutstandingRow[] = [];
  for (const s of students) {
    const foodDue = foodOutstanding(invoiced.get(s.id) ?? 0, paid.get(`${s.id}|FOOD`) ?? 0);
    const daycareDue = foodOutstanding(daycareInvoiced.get(s.id) ?? 0, paid.get(`${s.id}|DAYCARE`) ?? 0);
    const fundDue = s.isActive ? Math.max(0, s.class.annualFundAmount - (paid.get(`${s.id}|ANNUAL_FUND`) ?? 0)) : 0;
    const isActiveYear = s.class.schoolYear.isActive;
    if (!((s.isActive && isActiveYear) || foodDue > 0 || daycareDue > 0 || (s.isActive && fundDue > 0))) continue;
    rows.push({
      studentId: s.id,
      studentName: s.name,
      classId: s.class.id,
      className: s.class.name,
      schoolYearName: s.class.schoolYear.name,
      isActiveYear,
      isActive: s.isActive,
      foodDue,
      daycareDue,
      fundDue,
    });
  }
  return rows;
}
