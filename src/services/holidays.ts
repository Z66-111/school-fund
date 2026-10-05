import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { parseDateOnly } from "@/lib/dates";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { dateStringSchema } from "@/services/school-years";
import type { Actor } from "@/lib/roles";

const holidaySchema = z.object({
  schoolYearId: z.string().min(1),
  date: dateStringSchema,
  name: z.string().trim().min(1, mn.errors.required),
});

export async function addHoliday(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(holidaySchema, input);
  const year = await prisma.schoolYear.findUnique({ where: { id: v.schoolYearId } });
  if (!year) throw new NotFoundError();
  const date = parseDateOnly(v.date);
  if (date < year.startDate || date > year.endDate) {
    throw new ValidationError({ date: [mn.errors.dateOutsideYear] });
  }
  const existing = await prisma.holiday.findUnique({ where: { schoolYearId_date: { schoolYearId: v.schoolYearId, date } } });
  if (existing) throw new ValidationError({ date: [mn.errors.holidayExists] });
  return prisma.holiday.create({ data: { schoolYearId: v.schoolYearId, date, name: v.name } });
}

export async function deleteHoliday(actor: Actor, id: string): Promise<void> {
  requireRole(actor, "ADMIN");
  await prisma.holiday.delete({ where: { id } });
}

export function listHolidays(schoolYearId: string) {
  return prisma.holiday.findMany({ where: { schoolYearId }, orderBy: { date: "asc" } });
}

export async function holidayDates(schoolYearId: string): Promise<Date[]> {
  const rows = await prisma.holiday.findMany({ where: { schoolYearId }, select: { date: true } });
  return rows.map((r) => r.date);
}
