import { describe, it, expect } from "vitest";
import { chargesFor } from "@/services/charges";
import { studentBalances, outstandingTable } from "@/services/payments";
import { monthlyFoodReport } from "@/services/reports";
import { closeMonth } from "@/services/month-close";
import { prisma } from "@/lib/db";
import { dateOnly } from "@/lib/dates";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z");

async function setup() {
  const t = await f.user("TEACHER");
  const acc = await f.user("ACCOUNTANT");
  const y = await f.schoolYear({ isActive: true });
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id, dailyFoodRate: 3000 });
  await prisma.class.update({ where: { id: c.id }, data: { dailyDaycareRate: 27000 } });
  const s = await f.student(c.id);
  return { t, acc, y, c, s };
}

const enroll = (studentId: string, month: number, day = 1) =>
  prisma.student.update({ where: { id: studentId }, data: { daycareFrom: dateOnly(2026, month, day) } });

async function skip(studentId: string, month: number, days: number[]) {
  for (const d of days) await prisma.daycareSkip.create({ data: { studentId, date: dateOnly(2026, month, d) } });
}

async function mark(studentId: string, month: number, days: number[], status = "PRESENT") {
  for (const d of days) await prisma.attendance.create({ data: { studentId, date: dateOnly(2026, month, d), status } });
}

describe("running charges for open months", () => {
  it("bill present days so far at today's rates before the month is closed", async () => {
    const { s, acc } = await setup();
    await mark(s.id, 10, [1, 2, 5]);
    await mark(s.id, 10, [6], "ABSENT");
    await mark(s.id, 10, [7], "SICK");
    await enroll(s.id, 10);
    const b = await studentBalances(actorOf(acc), s.id, NOW);
    expect(b.invoices).toEqual([expect.objectContaining({ year: 2026, month: 10, daysPresent: 3, amount: 9000, provisional: true, outstanding: 9000 })]);
    // Daycare is prepaid: all 22 school days of October are owed on the 20th, whatever the attendance.
    expect(b.daycareInvoices).toEqual([expect.objectContaining({ daysPresent: 22, deductedDays: 0, amount: 594000, provisional: true })]);
    expect((await outstandingTable(actorOf(acc), undefined, NOW)).find((r) => r.studentId === s.id)).toMatchObject({ foodDue: 9000, daycareDue: 594000 });
  });

  it("closing the month swaps the running charge for the frozen invoice, never both", async () => {
    const { s, c, t, acc } = await setup();
    await mark(s.id, 9, [1, 2]);
    await closeMonth(actorOf(t), { classId: c.id, year: "2026", month: "9" }, NOW);
    await mark(s.id, 10, [1]);
    const ch = (await chargesFor([s.id])).get(s.id)!;
    expect(ch.food.map((i) => [i.month, i.amount, i.provisional]).sort()).toEqual([[10, 3000, true], [9, 6000, false]].sort());
    const b = await studentBalances(actorOf(acc), s.id);
    expect(b.foodInvoiced).toBe(9000);
  });

  it("skips inactive students; daycare follows enrolment, not class attendance", async () => {
    const { s, c } = await setup();
    const other = await f.student(c.id);
    await mark(other.id, 10, [1, 2]);
    await enroll(other.id, 10);
    await prisma.student.update({ where: { id: s.id }, data: { isActive: false } });
    await mark(s.id, 10, [1]);
    await enroll(s.id, 10);
    const ch = await chargesFor([s.id, other.id], NOW);
    expect(ch.get(s.id)).toEqual({ food: [], daycare: [] });
    expect(ch.get(other.id)!.food).toEqual([expect.objectContaining({ daysPresent: 2 })]);
    expect(ch.get(other.id)!.daycare).toEqual([expect.objectContaining({ daysPresent: 22, amount: 594000 })]);
  });

  it("monthly report shows running rows for an open month", async () => {
    const { s, c, t } = await setup();
    await enroll(s.id, 9);
    await skip(s.id, 9, [3, 4]);
    const r = await monthlyFoodReport(actorOf(t), c.id, 2026, 10, "DAYCARE", NOW);
    expect(r.closed).toBe(false);
    expect(r.rows).toEqual([expect.objectContaining({ daysPresent: 22, deductedDays: 2, amount: 540000, provisional: true })]);
  });

  it("prepaid daycare: days skipped in a month come off the next month, and closing freezes both", async () => {
    const { s, c, t, acc } = await setup();
    await enroll(s.id, 9);
    await skip(s.id, 9, [3, 4]);
    const open = (await chargesFor([s.id], NOW)).get(s.id)!.daycare;
    expect(open.map((i) => [i.month, i.daysPresent, i.deductedDays, i.amount, i.provisional])).toEqual([[9, 22, 0, 594000, true], [10, 22, 2, 540000, true]]);
    await closeMonth(actorOf(t), { classId: c.id, year: "2026", month: "9" }, NOW);
    await closeMonth(actorOf(t), { classId: c.id, year: "2026", month: "10" }, NOW);
    const inv = await prisma.daycareInvoice.findMany({ orderBy: { month: "asc" } });
    expect(inv.map((i) => [i.month, i.daysPresent, i.deductedDays, i.rate, i.amount])).toEqual([[9, 22, 0, 27000, 594000], [10, 22, 2, 27000, 540000]]);
    // Frozen: a later rate change or a late skip no longer moves the closed months.
    await prisma.class.update({ where: { id: c.id }, data: { dailyDaycareRate: 30000 } });
    const b = await studentBalances(actorOf(acc), s.id, NOW);
    expect(b.daycareInvoices.map((i) => [i.month, i.amount, i.provisional])).toEqual([[9, 594000, false], [10, 540000, false]]);
    expect(b.daycareOutstanding).toBe(1134000);
    // November opens at the new rate with nothing to deduct (no October skips).
    const nov = (await chargesFor([s.id], new Date("2026-11-02T04:00:00Z"))).get(s.id)!.daycare.find((i) => i.month === 11);
    expect(nov).toMatchObject({ daysPresent: 21, deductedDays: 0, rate: 30000, amount: 630000, provisional: true });
  });
});
