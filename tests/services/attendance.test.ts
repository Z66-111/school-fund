import { describe, it, expect } from "vitest";
import { saveAttendance, saveDaycare, getMonthAttendance, getMonthDaycareSkips, isMonthClosed } from "@/services/attendance";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z"); // 2026-10-20 in UB

async function setup() {
  const t = await f.user("TEACHER");
  const y = await f.schoolYear();
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id });
  const s = await f.student(c.id);
  return { t, y, c, s, actor: actorOf(t) };
}

const one = (classId: string, studentId: string, date: string, status: "PRESENT" | "ABSENT" | "SICK" | null = "PRESENT") =>
  ({ classId, changes: [{ studentId, date, status }] });

describe("saveAttendance", () => {
  it("stores a batch of marks, updates statuses and clears with null", async () => {
    const { c, s, actor } = await setup();
    const s2 = await f.student(c.id);
    expect(await saveAttendance(actor, { classId: c.id, changes: [
      { studentId: s.id, date: "2026-10-05", status: "PRESENT" },
      { studentId: s2.id, date: "2026-10-05", status: "SICK" },
      { studentId: s.id, date: "2026-10-06", status: "ABSENT" },
    ] }, NOW)).toBe(3);
    await saveAttendance(actor, { classId: c.id, changes: [
      { studentId: s.id, date: "2026-10-05", status: "ABSENT" },
      { studentId: s.id, date: "2026-10-06", status: null },
    ] }, NOW);
    const rows = await getMonthAttendance(c.id, 2026, 10);
    expect(rows.map((r) => [r.studentId, r.date.toISOString().slice(0, 10), r.status]).sort()).toEqual(
      [[s.id, "2026-10-05", "ABSENT"], [s2.id, "2026-10-05", "SICK"]].sort(),
    );
    expect(await getMonthAttendance(c.id, 2026, 9)).toEqual([]);
  });
  it("rejects future dates, weekends, holidays, and saves nothing from a bad batch", async () => {
    const { c, s, y, actor } = await setup();
    await f.holiday(y.id, new Date("2026-10-06T00:00:00Z"));
    await expect(saveAttendance(actor, one(c.id, s.id, "2026-10-21"), NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(saveAttendance(actor, one(c.id, s.id, "2026-10-04"), NOW)).rejects.toMatchObject({ code: "NON_CHARGEABLE_DAY" });
    await expect(saveAttendance(actor, one(c.id, s.id, "2026-10-06"), NOW)).rejects.toMatchObject({ code: "NON_CHARGEABLE_DAY" });
    await expect(saveAttendance(actor, { classId: c.id, changes: [
      { studentId: s.id, date: "2026-10-05", status: "PRESENT" },
      { studentId: s.id, date: "2026-10-21", status: "PRESENT" },
    ] }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    expect(await prisma.attendance.count()).toBe(0);
  });
  it("rejects when month is closed", async () => {
    const { s, c, t, actor } = await setup();
    await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
    expect(await isMonthClosed(c.id, 2026, 9)).toBe(true);
    await expect(saveAttendance(actor, one(c.id, s.id, "2026-09-15"), NOW)).rejects.toMatchObject({ code: "MONTH_CLOSED" });
  });
  it("other teacher, accountant, admin, and students from another class are refused", async () => {
    const { c, s, actor, y } = await setup();
    const t2 = await f.user("TEACHER");
    await expect(saveAttendance(actorOf(t2), one(c.id, s.id, "2026-10-05"), NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(saveAttendance(actorOf(acc), one(c.id, s.id, "2026-10-05"), NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await f.user("ADMIN");
    await expect(saveAttendance(actorOf(admin), one(c.id, s.id, "2026-10-05"), NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const other = await f.klass({ teacherId: t2.id, schoolYearId: y.id });
    const stranger = await f.student(other.id);
    await expect(saveAttendance(actor, one(c.id, stranger.id, "2026-10-05"), NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("saveDaycare", () => {
  const enroll = (studentId: string, from = "2026-10-01", until: string | null = null) =>
    prisma.student.update({ where: { id: studentId }, data: { daycareFrom: new Date(`${from}T00:00:00Z`), daycareUntil: until ? new Date(`${until}T00:00:00Z`) : null } });

  it("records skipped days for an enrolled child and removes them again, separately from class attendance", async () => {
    const { c, s, actor } = await setup();
    await enroll(s.id);
    await saveDaycare(actor, { classId: c.id, changes: [
      { studentId: s.id, date: "2026-10-05", present: false },
      { studentId: s.id, date: "2026-10-07", present: false },
      { studentId: s.id, date: "2026-10-08", present: true }, // already "stayed": nothing to store
    ] }, NOW);
    await saveDaycare(actor, { classId: c.id, changes: [{ studentId: s.id, date: "2026-10-07", present: true }] }, NOW);
    expect((await getMonthDaycareSkips(c.id, 2026, 10)).map((r) => r.date.toISOString().slice(0, 10))).toEqual(["2026-10-05"]);
    expect(await getMonthAttendance(c.id, 2026, 10)).toEqual([]);
  });
  it("uses the same date and access rules as attendance", async () => {
    const { c, s, t, actor } = await setup();
    await enroll(s.id, "2026-09-01");
    await expect(saveDaycare(actor, { classId: c.id, changes: [{ studentId: s.id, date: "2026-10-21", present: false }] }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(saveDaycare(actor, { classId: c.id, changes: [{ studentId: s.id, date: "2026-10-04", present: false }] }, NOW)).rejects.toMatchObject({ code: "NON_CHARGEABLE_DAY" });
    await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
    await expect(saveDaycare(actor, { classId: c.id, changes: [{ studentId: s.id, date: "2026-09-15", present: false }] }, NOW)).rejects.toMatchObject({ code: "MONTH_CLOSED" });
    const acc = await f.user("ACCOUNTANT");
    await expect(saveDaycare(actorOf(acc), { classId: c.id, changes: [{ studentId: s.id, date: "2026-10-05", present: false }] }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.daycareSkip.count()).toBe(0);
  });
  it("rejects days outside the child's enrolment, saving nothing from the batch", async () => {
    const { c, s, actor } = await setup();
    const notEnrolled = await f.student(c.id);
    await enroll(s.id, "2026-10-06", "2026-10-09");
    const skip = (studentId: string, date: string) => saveDaycare(actor, { classId: c.id, changes: [{ studentId: s.id, date: "2026-10-07", present: false }, { studentId, date, present: false }] }, NOW);
    await expect(skip(notEnrolled.id, "2026-10-07")).rejects.toMatchObject({ code: "NOT_ENROLLED" });
    await expect(skip(s.id, "2026-10-05")).rejects.toMatchObject({ code: "NOT_ENROLLED" }); // before the start
    await expect(skip(s.id, "2026-10-12")).rejects.toMatchObject({ code: "NOT_ENROLLED" }); // after the end
    expect(await prisma.daycareSkip.count()).toBe(0);
    await expect(skip(s.id, "2026-10-09")).resolves.toBe(2);
  });
});
