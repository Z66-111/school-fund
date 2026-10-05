import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { dateOnly } from "@/lib/dates";
import type { Actor, Role } from "@/lib/roles";

export async function resetDb() {
  await prisma.$transaction([
    prisma.expense.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.foodInvoice.deleteMany(),
    prisma.monthClose.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.parentStudent.deleteMany(),
    prisma.student.deleteMany(),
    prisma.class.deleteMany(),
    prisma.holiday.deleteMany(),
    prisma.schoolYear.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

let seq = 0;
const next = () => ++seq;

export const PASSWORD = "secret123";

export const f = {
  async user(role: Role, o: Partial<{ name: string; email: string; password: string }> = {}) {
    const n = next();
    return prisma.user.create({
      data: {
        name: o.name ?? `${role.toLowerCase()} ${n}`,
        email: o.email ?? `${role.toLowerCase()}${n}@test.local`,
        passwordHash: await hashPassword(o.password ?? PASSWORD),
        role,
      },
    });
  },
  async schoolYear(o: Partial<{ name: string; isActive: boolean; startDate: Date; endDate: Date }> = {}) {
    const n = next();
    return prisma.schoolYear.create({
      data: {
        name: o.name ?? `Year ${n}`,
        startDate: o.startDate ?? dateOnly(2026, 9, 1),
        endDate: o.endDate ?? dateOnly(2027, 6, 1),
        isActive: o.isActive ?? true,
      },
    });
  },
  async klass(o: Partial<{ name: string; schoolYearId: string; teacherId: string | null; dailyFoodRate: number; annualFundAmount: number }> = {}) {
    const n = next();
    const schoolYearId = o.schoolYearId ?? (await f.schoolYear()).id;
    return prisma.class.create({
      data: {
        name: o.name ?? `Class ${n}`,
        schoolYearId,
        teacherId: o.teacherId ?? null,
        dailyFoodRate: o.dailyFoodRate ?? 3000,
        annualFundAmount: o.annualFundAmount ?? 50000,
      },
    });
  },
  async student(classId: string, o: Partial<{ name: string; isActive: boolean }> = {}) {
    const n = next();
    return prisma.student.create({ data: { classId, name: o.name ?? `Student ${n}`, isActive: o.isActive ?? true } });
  },
  async link(parentUserId: string, studentId: string) {
    return prisma.parentStudent.create({ data: { parentUserId, studentId } });
  },
  async holiday(schoolYearId: string, date: Date, name = "Holiday") {
    return prisma.holiday.create({ data: { schoolYearId, date, name } });
  },
};

export const actorOf = (u: { id: string; role: string }): Actor => ({ userId: u.id, role: u.role as Role });
