import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess, assertStudentAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { AppError, ValidationError } from "@/lib/errors";
import { createUser } from "@/services/users";
import { normalizeEmail } from "@/services/auth";
import { parseDateOnly, todayDate } from "@/lib/dates";
import { dateStringSchema } from "@/services/school-years";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

const addSchema = z.object({ classId: z.string().min(1), name: z.string().trim().min(1, mn.errors.required) });

/** New students are enrolled in Өдөр өнжүүлэх from the day they are added; the teacher can change or remove that on the students page. */
export async function addStudent(actor: Actor, input: unknown, now: Date = new Date()) {
  requireRole(actor, "TEACHER", "ADMIN");
  const v = parse(addSchema, input);
  await assertClassAccess(actor, v.classId);
  return prisma.student.create({ data: { ...v, daycareFrom: todayDate(now) } });
}

export async function setStudentActive(actor: Actor, studentId: string, isActive: boolean): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  await assertStudentAccess(actor, studentId);
  await prisma.student.update({ where: { id: studentId }, data: { isActive } });
}

const optionalDate = z.string().trim().refine((v) => v === "" || dateStringSchema.safeParse(v).success, mn.errors.invalidDate);
const daycareSchema = z.object({ studentId: z.string().min(1), from: optionalDate.default(""), until: optionalDate.default("") });

/**
 * Enrols a student in Өдөр өнжүүлэх from a start date, optionally up to an end date. An empty
 * start date removes the enrolment; charges of months already closed stay as they are.
 */
export async function setDaycareEnrollment(actor: Actor, input: unknown): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  const v = parse(daycareSchema, input);
  await assertStudentAccess(actor, v.studentId);
  const from = v.from ? parseDateOnly(v.from) : null;
  const until = from && v.until ? parseDateOnly(v.until) : null;
  if (from && until && until.getTime() < from.getTime()) throw new ValidationError({ until: [mn.errors.daycareUntilBeforeFrom] });
  await prisma.student.update({ where: { id: v.studentId }, data: { daycareFrom: from, daycareUntil: until } });
}

export async function deleteStudent(actor: Actor, studentId: string): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  await assertStudentAccess(actor, studentId);
  const [inv, daycareInv, pay] = await Promise.all([
    prisma.foodInvoice.count({ where: { studentId } }),
    prisma.daycareInvoice.count({ where: { studentId } }),
    prisma.payment.count({ where: { studentId } }),
  ]);
  if (inv > 0 || daycareInv > 0 || pay > 0) throw new AppError("STUDENT_HAS_RECORDS", mn.errors.studentHasRecords);
  await prisma.student.delete({ where: { id: studentId } });
}

const linkSchema = z.object({ studentId: z.string().min(1), email: z.string().trim().min(1) });

export async function linkParent(actor: Actor, input: unknown): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  const v = parse(linkSchema, input);
  await assertStudentAccess(actor, v.studentId);
  const parent = await prisma.user.findUnique({ where: { email: normalizeEmail(v.email) } });
  if (!parent || parent.role !== "PARENT") throw new ValidationError({ email: [mn.errors.notParent] });
  await prisma.parentStudent.upsert({
    where: { parentUserId_studentId: { parentUserId: parent.id, studentId: v.studentId } },
    update: {},
    create: { parentUserId: parent.id, studentId: v.studentId },
  });
}

const createParentSchema = z.object({
  studentId: z.string().min(1),
  name: z.string().trim().min(1, mn.errors.required),
  email: z.string().trim().email(mn.errors.invalidEmail),
  password: z.string().min(6, mn.errors.passwordShort),
});

export async function createParentForStudent(actor: Actor, input: unknown) {
  requireRole(actor, "TEACHER", "ADMIN");
  const v = parse(createParentSchema, input);
  await assertStudentAccess(actor, v.studentId);
  const parent = await createUser(actor, { name: v.name, email: v.email, password: v.password, role: "PARENT" });
  await prisma.parentStudent.create({ data: { parentUserId: parent.id, studentId: v.studentId } });
  return parent;
}

export function listStudents(classId: string, includeInactive = false) {
  return prisma.student.findMany({
    where: { classId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { name: "asc" },
    include: { parents: { include: { parent: { select: { name: true, email: true } } } } },
  });
}

export function listChildren(parentUserId: string) {
  return prisma.student.findMany({
    where: { parents: { some: { parentUserId } } },
    orderBy: { name: "asc" },
    include: { class: { select: { id: true, name: true } } },
  });
}
