import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { dateOnly, daysInMonth, isFuture, monthRange, toISODate } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { parseAttendanceSheet, matchNames } from "@/lib/attendance-sheet";
import { holidayDates } from "@/services/holidays";
import { saveAttendance } from "@/services/attendance";
import type { Actor, AttendanceStatus } from "@/lib/roles";

export type SheetReport = {
  sheet: string;
  status: "imported" | "closed" | "unknownMonth" | "outsideYear" | "empty";
  year?: number;
  month?: number;
  days: number; // school days taken from the sheet
  futureDays: number;
  nonSchoolDays: number[]; // weekends, holidays or impossible dates in the sheet's header
  present: number;
  absent: number;
  sick: number;
  unknownMarks: number;
  unmatched: string[]; // names in the sheet with no student
  approximated: { from: string; to: string }[];
  missing: string[]; // active students the sheet does not list
};

/**
 * Registers class attendance from a teacher's workbook (see `lib/attendance-sheet`). Each month
 * sheet replaces the marks of the days it lists, for the children it names; days and children it
 * does not mention are left alone. Closed months and future days are skipped, never an error,
 * so the same file can be uploaded again as the year goes on.
 */
export async function importAttendance(actor: Actor, classId: string, sheets: { sheet: string; data: unknown[][] }[], now: Date = new Date()): Promise<SheetReport[]> {
  requireRole(actor, "TEACHER");
  await assertClassAccess(actor, classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: classId }, include: { schoolYear: true } });
  const [students, holidays, closes] = await Promise.all([
    prisma.student.findMany({ where: { classId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    holidayDates(klass.schoolYearId),
    prisma.monthClose.findMany({ where: { classId }, select: { year: true, month: true } }),
  ]);
  const closed = new Set(closes.map((c) => `${c.year}-${c.month}`));
  const { startDate, endDate } = klass.schoolYear;

  const reports: SheetReport[] = [];
  for (const { sheet, data } of sheets) {
    const p = parseAttendanceSheet(sheet, data);
    const r: SheetReport = { sheet, status: "imported", days: 0, futureDays: 0, nonSchoolDays: [], present: 0, absent: 0, sick: 0, unknownMarks: 0, unmatched: [], approximated: [], missing: [] };
    reports.push(r);
    if (p.month === null) { r.status = "unknownMonth"; continue; }
    r.month = p.month;
    if (p.days.length === 0 || p.rows.length === 0) { r.status = "empty"; continue; }
    // The sheet names only a month; the school year decides which calendar year it belongs to.
    const year = [startDate.getUTCFullYear(), endDate.getUTCFullYear()].find((y) => {
      const { start, end } = monthRange(y, p.month!);
      return end.getTime() > startDate.getTime() && start.getTime() <= endDate.getTime();
    });
    if (year === undefined) { r.status = "outsideYear"; continue; }
    r.year = year;
    if (closed.has(`${year}-${p.month}`)) { r.status = "closed"; continue; }

    const days: number[] = [];
    for (const day of p.days) {
      const date = day <= daysInMonth(year, p.month) ? dateOnly(year, p.month, day) : null;
      if (!date || !isChargeable(date, holidays) || date.getTime() < startDate.getTime() || date.getTime() > endDate.getTime()) r.nonSchoolDays.push(day);
      else if (isFuture(date, now)) r.futureDays++;
      else days.push(day);
    }
    r.days = days.length;

    const { matched, unmatched } = matchNames(p.rows.map((row) => row.name), students);
    r.unmatched = unmatched;
    r.approximated = [...matched].filter(([, s]) => s.approximate).map(([from, s]) => ({ from, to: s.name }));
    const seen = new Set([...matched.values()].map((s) => s.id));
    r.missing = students.filter((s) => !seen.has(s.id)).map((s) => s.name);

    const changes: { studentId: string; date: string; status: AttendanceStatus }[] = [];
    for (const row of p.rows) {
      const student = matched.get(row.name);
      if (!student) continue;
      r.unknownMarks += row.unknownMarks;
      for (const day of days) {
        const status = row.marks[day];
        if (!status) continue; // an unreadable mark: leave whatever is stored
        changes.push({ studentId: student.id, date: toISODate(dateOnly(year, p.month, day)), status });
        if (status === "PRESENT") r.present++;
        else if (status === "ABSENT") r.absent++;
        else r.sick++;
      }
    }
    for (let i = 0; i < changes.length; i += 4000) await saveAttendance(actor, { classId, changes: changes.slice(i, i + 4000) }, now);
  }
  return reports;
}
