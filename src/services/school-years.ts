import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { parseDateOnly } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export const dateStringSchema = z.string().refine(
  (s) => {
    try {
      parseDateOnly(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: mn.errors.invalidDate },
);

const schoolYearSchema = z
  .object({
    name: z.string().trim().min(1, mn.errors.required),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine(
    (v) => {
      // Zod 4 runs object-level refines even when field checks failed; skip then (field errors already reported).
      if (!dateStringSchema.safeParse(v.startDate).success || !dateStringSchema.safeParse(v.endDate).success) return true;
      return parseDateOnly(v.startDate) < parseDateOnly(v.endDate);
    },
    {
      message: mn.errors.invalidDate,
      path: ["endDate"],
    },
  );

export async function createSchoolYear(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(schoolYearSchema, input);
  return prisma.schoolYear.create({
    data: { name: v.name, startDate: parseDateOnly(v.startDate), endDate: parseDateOnly(v.endDate) },
  });
}

export async function activateSchoolYear(actor: Actor, id: string): Promise<void> {
  requireRole(actor, "ADMIN");
  await prisma.$transaction([
    prisma.schoolYear.updateMany({ data: { isActive: false } }),
    prisma.schoolYear.update({ where: { id }, data: { isActive: true } }),
  ]);
}

export function listSchoolYears() {
  return prisma.schoolYear.findMany({ orderBy: { startDate: "desc" } });
}

export async function getActiveSchoolYear() {
  const y = await prisma.schoolYear.findFirst({ where: { isActive: true } });
  if (!y) throw new AppError("NO_ACTIVE_YEAR", mn.errors.noActiveYear);
  return y;
}
