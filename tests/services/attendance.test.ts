import { describe, it, expect } from "vitest";
import { toggleAttendance, markAllPresent, getMonthAttendance, isMonthClosed } from "@/services/attendance";
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

describe("toggleAttendance", () => {
  it("cycles unmarked -> PRESENT -> ABSENT -> unmarked", async () => {
    const { s, actor } = await setup();
    expect(await toggleAttendance(actor, { studentId: s.id, date: "2026-10-05" }, NOW)).toBe("PRESENT");
    expect(await toggleAttendance(actor, { studentId: s.id, date: "2026-10-05" }, NOW)).toBe("ABSENT");
    expect(await toggleAttendance(actor, { studentId: s.id, date: "2026-10-05" }, NOW)).toBeNull();
    expect(await prisma.attendance.count()).toBe(0);
  });
  it("rejects future dates, weekends, holidays", async () => {
    const { s, y, actor } = await setup();
    await f.holiday(y.id, new Date("2026-10-06T00:00:00Z"));
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-10-21" }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-10-04" }, NOW)).rejects.toMatchObject({ code: "NON_CHARGEABLE_DAY" });
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-10-06" }, NOW)).rejects.toMatchObject({ code: "NON_CHARGEABLE_DAY" });
  });
  it("rejects when month is closed", async () => {
    const { s, c, t, actor } = await setup();
    await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
    expect(await isMonthClosed(c.id, 2026, 9)).toBe(true);
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-09-15" }, NOW)).rejects.toMatchObject({ code: "MONTH_CLOSED" });
  });
  it("other teacher, accountant and admin cannot mark", async () => {
    const { s } = await setup();
    const t2 = await f.user("TEACHER");
    await expect(toggleAttendance(actorOf(t2), { studentId: s.id, date: "2026-10-05" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(toggleAttendance(actorOf(acc), { studentId: s.id, date: "2026-10-05" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await f.user("ADMIN");
    await expect(toggleAttendance(actorOf(admin), { studentId: s.id, date: "2026-10-05" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("markAllPresent / getMonthAttendance", () => {
  it("marks active students only and reads back the month", async () => {
    const { c, s, actor } = await setup();
    await f.student(c.id, { isActive: false });
    const s3 = await f.student(c.id);
    expect(await markAllPresent(actor, { classId: c.id, date: "2026-10-20" }, NOW)).toBe(2);
    expect(await markAllPresent(actor, { classId: c.id, date: "2026-10-20" }, NOW)).toBe(2); // idempotent
    const rows = await getMonthAttendance(c.id, 2026, 10);
    expect(rows.map((r) => r.studentId).sort()).toEqual([s.id, s3.id].sort());
    expect(rows.every((r) => r.status === "PRESENT")).toBe(true);
    expect(await getMonthAttendance(c.id, 2026, 9)).toEqual([]);
  });
});
