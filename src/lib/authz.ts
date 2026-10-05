import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor, Role } from "@/lib/roles";

export function requireRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw new ForbiddenError();
}

export async function assertClassAccess(actor: Actor, classId: string): Promise<void> {
  const klass = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, teacherId: true } });
  if (!klass) throw new NotFoundError();
  if (actor.role === "ADMIN" || actor.role === "ACCOUNTANT") return;
  if (actor.role === "TEACHER") {
    if (klass.teacherId === actor.userId) return;
    throw new ForbiddenError();
  }
  const link = await prisma.parentStudent.findFirst({
    where: { parentUserId: actor.userId, student: { classId } },
  });
  if (!link) throw new ForbiddenError();
}

export async function assertStudentAccess(actor: Actor, studentId: string): Promise<{ id: string; classId: string }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true, class: { select: { teacherId: true } } },
  });
  if (!student) throw new NotFoundError();
  if (actor.role === "ADMIN" || actor.role === "ACCOUNTANT") return { id: student.id, classId: student.classId };
  if (actor.role === "TEACHER") {
    if (student.class.teacherId === actor.userId) return { id: student.id, classId: student.classId };
    throw new ForbiddenError();
  }
  const link = await prisma.parentStudent.findUnique({
    where: { parentUserId_studentId: { parentUserId: actor.userId, studentId } },
  });
  if (!link) throw new ForbiddenError();
  return { id: student.id, classId: student.classId };
}
