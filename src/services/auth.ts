import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Role } from "@/lib/roles";

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function authenticate(email: string, password: string): Promise<{ id: string; role: Role }> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", mn.errors.invalidCredentials);
  }
  return { id: user.id, role: user.role as Role };
}
