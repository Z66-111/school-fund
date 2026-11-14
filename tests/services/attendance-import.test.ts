import { describe, it, expect } from "vitest";
import { importAttendance } from "@/services/attendance-import";
import { prisma } from "@/lib/db";
import { dateOnly } from "@/lib/dates";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z"); // Tuesday 20 Oct 2026 in Ulaanbaatar

async function setup() {
  const t = await f.user("TEACHER");
  const y = await f.schoolYear();
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id });
  const a = await f.student(c.id, { name: "Дулам Сувд" });
  const b = await f.student(c.id, { name: "Ганболд Номин" });
  const quiet = await f.student(c.id, { name: "Сарнай" });
  return { t, y, c, a, b, quiet, actor: actorOf(t) };
}

const marks = async (studentId: string) =>
  Object.fromEntries((await prisma.attendance.findMany({ where: { studentId }, orderBy: { date: "asc" } })).map((r) => [r.date.toISOString().slice(5, 10), r.status]));

// Oct 2026: the 3rd/4th are a weekend; the 21st onward is still in the future.
const october = { sheet: "октябрь", data: [
  ["№", "ФИО ребёнка", 1, 2, 3, 5, 21, 22, "дней"],
  [1, "Дулам Сувд", null, "н", null, "б", null, null, 2],
  [2, "Ганболд Номн", "Н", null, null, null, "н", null, 3],
  [3, "Танихгүй Хүүхэд", null, null, null, null, null, null, 4],
  ["Итого", 9, 1, 2, 3, 2, 0, 0, null],
] };

describe("importAttendance", () => {
  it("registers each listed school day: blank present, «н» absent, «б» sick; skips weekend and future days", async () => {
    const { c, a, b, quiet, actor } = await setup();
    const [r] = await importAttendance(actor, c.id, [october], NOW);
    expect(r).toMatchObject({
      sheet: "октябрь", status: "imported", year: 2026, month: 10, days: 3, futureDays: 2, nonSchoolDays: [3],
      present: 3, absent: 2, sick: 1, unknownMarks: 0,
      unmatched: ["Танихгүй Хүүхэд"], approximated: [{ from: "Ганболд Номн", to: "Ганболд Номин" }], missing: ["Сарнай"],
    });
    expect(await marks(a.id)).toEqual({ "10-01": "PRESENT", "10-02": "ABSENT", "10-05": "SICK" });
    expect(await marks(b.id)).toEqual({ "10-01": "ABSENT", "10-02": "PRESENT", "10-05": "PRESENT" });
    expect(await marks(quiet.id)).toEqual({});
  });
  it("replaces earlier marks on the sheet's days and leaves other days alone; uploading twice changes nothing", async () => {
    const { c, a, actor } = await setup();
    await prisma.attendance.createMany({ data: [
      { studentId: a.id, date: dateOnly(2026, 10, 1), status: "ABSENT" },
      { studentId: a.id, date: dateOnly(2026, 10, 6), status: "SICK" }, // not a column in the sheet
    ] });
    await importAttendance(actor, c.id, [october], NOW);
    await importAttendance(actor, c.id, [october], NOW);
    expect(await marks(a.id)).toEqual({ "10-01": "PRESENT", "10-02": "ABSENT", "10-05": "SICK", "10-06": "SICK" });
    expect(await prisma.attendance.count()).toBe(7);
  });
  it("takes every month sheet, placing January-June in the school year's second calendar year; skips closed and unknown sheets", async () => {
    const { c, a, t, actor } = await setup();
    await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
    const row = (mark: string | null) => [1, "Дулам Сувд", mark, null, null];
    const reports = await importAttendance(actor, c.id, [
      { sheet: "сентябрь", data: [["№", "Нэр", 1, 2, 3], row("н")] },
      { sheet: "октябрь", data: [["№", "Нэр", 1, 2, 5], row("н")] },
      { sheet: "1-р сар", data: [["№", "Нэр", 4, 5, 6], row("н")] },
      { sheet: "июль", data: [["№", "Нэр", 1, 2, 3], row(null)] },
      { sheet: "Sheet4", data: [["№", "Нэр", 1, 2, 3], row(null)] },
      { sheet: "ноябрь", data: [["just a note"]] },
    ], new Date("2027-01-05T04:00:00Z"));
    expect(reports.map((r) => [r.sheet, r.status, r.year ?? null, r.days])).toEqual([
      ["сентябрь", "closed", 2026, 0],
      ["октябрь", "imported", 2026, 3],
      ["1-р сар", "imported", 2027, 2], // the 6th is still tomorrow
      ["июль", "outsideYear", null, 0],
      ["Sheet4", "unknownMonth", null, 0],
      ["ноябрь", "empty", null, 0],
    ]);
    expect(await marks(a.id)).toEqual({ "10-01": "ABSENT", "10-02": "PRESENT", "10-05": "PRESENT", "01-04": "ABSENT", "01-05": "PRESENT" });
  });
  it("treats holidays as non-school days and ignores inactive students", async () => {
    const { c, y, a, b, actor } = await setup();
    await f.holiday(y.id, dateOnly(2026, 10, 2));
    await prisma.student.update({ where: { id: b.id }, data: { isActive: false } });
    const [r] = await importAttendance(actor, c.id, [october], NOW);
    expect(r).toMatchObject({ days: 2, nonSchoolDays: [2, 3], unmatched: ["Ганболд Номн", "Танихгүй Хүүхэд"], missing: ["Сарнай"] });
    expect(await marks(a.id)).toEqual({ "10-01": "PRESENT", "10-05": "SICK" });
    expect(await marks(b.id)).toEqual({});
  });
  it("only the class's own teacher may import", async () => {
    const { c } = await setup();
    for (const role of ["TEACHER", "ADMIN", "ACCOUNTANT", "PARENT"] as const) {
      await expect(importAttendance(actorOf(await f.user(role)), c.id, [october], NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(await prisma.attendance.count()).toBe(0);
  });
});
