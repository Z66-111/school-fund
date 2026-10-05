import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { hashPassword } from "@/lib/password";
import { AppError, ForbiddenError } from "@/lib/errors";
import { normalizeEmail } from "@/services/auth";
import { ROLES, type Actor, type Role } from "@/lib/roles";
import { mn } from "@/lib/i18n/mn";

export const passwordSchema = z.string().min(6, mn.errors.passwordShort);

const userSchema = z.object({
  name: z.string().trim().min(1, mn.errors.required),
  email: z.string().trim().toLowerCase().email(mn.errors.invalidEmail),
  password: passwordSchema,
  role: z.enum(ROLES),
});

export async function createUser(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN", "TEACHER");
  const v = parse(userSchema, input);
  if (actor.role === "TEACHER" && v.role !== "PARENT") throw new ForbiddenError();
  const email = normalizeEmail(v.email);
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError("EMAIL_TAKEN", mn.errors.emailTaken);
  return prisma.user.create({ data: { name: v.name, email, passwordHash: await hashPassword(v.password), role: v.role } });
}

export async function resetPassword(actor: Actor, userId: string, password: string): Promise<void> {
  requireRole(actor, "ADMIN");
  const pw = parse(passwordSchema, password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw) } });
}

export function listUsers(role?: Role) {
  return prisma.user.findMany({ where: role ? { role } : {}, orderBy: [{ role: "asc" }, { name: "asc" }] });
}
