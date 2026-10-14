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

async function stay(studentId: string, month: number, days: number[]) {
  for (const d of days) await prisma.daycareAttendance.create({ data: { studentId, date: dateOnly(2026, month, d) } });
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
    await stay(s.id, 10, [1, 2, 5]);
    const b = await studentBalances(actorOf(acc), s.id);
    expect(b.invoices).toEqual([expect.objectContaining({ year: 2026, month: 10, daysPresent: 3, amount: 9000, provisional: true, outstanding: 9000 })]);
    expect(b.daycareInvoices).toEqual([expect.objectContaining({ daysPresent: 3, amount: 81000, provisional: true })]);
    expect((await outstandingTable(actorOf(acc))).find((r) => r.studentId === s.id)).toMatchObject({ foodDue: 9000, daycareDue: 81000 });
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

  it("skips inactive students; daycare follows ticked daycare days, not class attendance", async () => {
    const { s, c } = await setup();
    const other = await f.student(c.id);
    await mark(other.id, 10, [1, 2]);
    await stay(other.id, 10, [2]);
    await prisma.student.update({ where: { id: s.id }, data: { isActive: false } });
    await mark(s.id, 10, [1]);
    await stay(s.id, 10, [1]);
    const ch = await chargesFor([s.id, other.id]);
    expect(ch.get(s.id)).toEqual({ food: [], daycare: [] });
    expect(ch.get(other.id)!.food).toEqual([expect.objectContaining({ daysPresent: 2 })]);
    expect(ch.get(other.id)!.daycare).toEqual([expect.objectContaining({ daysPresent: 1, amount: 27000 })]);
  });

  it("monthly report shows running rows for an open month", async () => {
    const { s, c, t } = await setup();
    await stay(s.id, 10, [1, 2]);
    const r = await monthlyFoodReport(actorOf(t), c.id, 2026, 10, "DAYCARE");
    expect(r.closed).toBe(false);
    expect(r.rows).toEqual([expect.objectContaining({ daysPresent: 2, amount: 54000, provisional: true })]);
  });
});
