import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { moneySchema } from "@/lib/money";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

const ratesSchema = z.object({ dailyFoodRate: moneySchema, annualFundAmount: moneySchema });
const classSchema = ratesSchema.extend({
  name: z.string().trim().min(1, mn.errors.required),
  schoolYearId: z.string().min(1),
});

export async function createClass(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(classSchema, input);
  return prisma.class.create({ data: v });
}

export async function updateClassRates(actor: Actor, classId: string, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(ratesSchema, input);
  return prisma.class.update({ where: { id: classId }, data: v });
}

export async function assignTeacher(actor: Actor, classId: string, teacherId: string | null): Promise<void> {
  requireRole(actor, "ADMIN");
  if (teacherId) {
    const u = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!u || u.role !== "TEACHER") throw new ValidationError({ teacherId: [mn.errors.notTeacher] });
  }
  await prisma.class.update({ where: { id: classId }, data: { teacherId } });
}

export function listClasses(schoolYearId: string) {
  return prisma.class.findMany({
    where: { schoolYearId },
    orderBy: { name: "asc" },
    include: { teacher: { select: { name: true } }, _count: { select: { students: true } } },
  });
}

export async function getClass(classId: string) {
  const c = await prisma.class.findUnique({ where: { id: classId }, include: { schoolYear: true } });
  if (!c) throw new NotFoundError();
  return c;
}

export function getTeacherClass(teacherId: string) {
  return prisma.class.findFirst({ where: { teacherId, schoolYear: { isActive: true } } });
}
