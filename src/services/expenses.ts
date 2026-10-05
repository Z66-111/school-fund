import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { moneySchema } from "@/lib/money";
import { parseDateOnly, isFuture } from "@/lib/dates";
import { dateStringSchema } from "@/services/school-years";
import { AppError, NotFoundError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

const fieldsSchema = z.object({
  date: dateStringSchema,
  title: z.string().trim().min(1, mn.errors.required),
  amount: moneySchema,
  note: z.string().trim().max(500).optional().default(""),
});
const addSchema = fieldsSchema.extend({ classId: z.string().min(1) });

function dateOrThrow(s: string, now: Date): Date {
  const d = parseDateOnly(s);
  if (isFuture(d, now)) throw new AppError("FUTURE_DATE", mn.errors.futureDate);
  return d;
}

export async function addExpense(actor: Actor, input: unknown, now: Date = new Date()) {
  requireRole(actor, "TEACHER");
  const v = parse(addSchema, input);
  await assertClassAccess(actor, v.classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  return prisma.expense.create({
    data: { classId: v.classId, schoolYearId: klass.schoolYearId, date: dateOrThrow(v.date, now), title: v.title, amount: v.amount, note: v.note, createdById: actor.userId },
  });
}

export async function updateExpense(actor: Actor, expenseId: string, input: unknown, now: Date = new Date()) {
  requireRole(actor, "TEACHER");
  const v = parse(fieldsSchema, input);
  const e = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!e) throw new NotFoundError();
  await assertClassAccess(actor, e.classId);
  return prisma.expense.update({ where: { id: expenseId }, data: { date: dateOrThrow(v.date, now), title: v.title, amount: v.amount, note: v.note } });
}

export async function deleteExpense(actor: Actor, expenseId: string): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  const e = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!e) throw new NotFoundError();
  await assertClassAccess(actor, e.classId);
  await prisma.expense.delete({ where: { id: expenseId } });
}

export async function listExpenses(actor: Actor, classId: string) {
  await assertClassAccess(actor, classId);
  return prisma.expense.findMany({ where: { classId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
}
