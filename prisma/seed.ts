import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@school.local" },
    update: {},
    create: { name: "Админ", email: "admin@school.local", passwordHash: await hash("changeme"), role: "ADMIN" },
  });
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@school.local" },
    update: {},
    create: { name: "Багш Болд", email: "teacher@school.local", passwordHash: await hash("changeme"), role: "TEACHER" },
  });
  await prisma.user.upsert({
    where: { email: "accountant@school.local" },
    update: {},
    create: { name: "Нягтлан Сараа", email: "accountant@school.local", passwordHash: await hash("changeme"), role: "ACCOUNTANT" },
  });
  const parent = await prisma.user.upsert({
    where: { email: "parent@school.local" },
    update: {},
    create: { name: "Эцэг эх Дорж", email: "parent@school.local", passwordHash: await hash("changeme"), role: "PARENT" },
  });
  const year = await prisma.schoolYear.upsert({
    where: { name: "2026-2027" },
    update: {},
    create: { name: "2026-2027", startDate: utc(2026, 9, 1), endDate: utc(2027, 6, 1), isActive: true },
  });
  const klass = await prisma.class.upsert({
    where: { schoolYearId_name: { schoolYearId: year.id, name: "1А" } },
    update: {},
    create: { name: "1А", schoolYearId: year.id, teacherId: teacher.id, dailyFoodRate: 3000, annualFundAmount: 50000 },
  });
  const existing = await prisma.student.count({ where: { classId: klass.id } });
  if (existing === 0) {
    const s1 = await prisma.student.create({ data: { classId: klass.id, name: "Батбаяр" } });
    await prisma.student.create({ data: { classId: klass.id, name: "Сарнай" } });
    await prisma.parentStudent.create({ data: { parentUserId: parent.id, studentId: s1.id } });
  }
  console.log("Seeded. Login: admin@school.local / changeme (also teacher@, accountant@, parent@)");
  void admin;
}

main().finally(() => prisma.$disconnect());
