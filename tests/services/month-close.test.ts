import { describe, it, expect } from "vitest";
import { closeMonth, reopenMonth, listMonthCloses } from "@/services/month-close";
import { prisma } from "@/lib/db";
import { dateOnly } from "@/lib/dates";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z");

async function setup() {
  const t = await f.user("TEACHER");
  const y = await f.schoolYear();
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id, dailyFoodRate: 3000 });
  const s1 = await f.student(c.id);
  const s2 = await f.student(c.id);
  return { t, y, c, s1, s2, actor: actorOf(t) };
}

async function present(studentId: string, ...days: number[]) {
  for (const d of days) await prisma.attendance.create({ data: { studentId, date: dateOnly(2026, 9, d), status: "PRESENT" } });
}

describe("closeMonth", () => {
  it("creates one invoice per active student using chargeable present days", async () => {
    const { c, s1, s2, y, actor } = await setup();
    await f.holiday(y.id, dateOnly(2026, 9, 7));
    await present(s1.id, 1, 2, 5, 7); // Sep 5 2026 is Saturday, Sep 7 holiday -> 2 days
    await present(s2.id, 1);
    const r = await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    expect(r.invoices).toBe(2);
    const inv = await prisma.foodInvoice.findMany({ orderBy: { amount: "desc" } });
    expect(inv.map((i) => [i.daysPresent, i.rate, i.amount])).toEqual([[2, 3000, 6000], [1, 3000, 3000]]);
    expect((await listMonthCloses(c.id)).map((m) => m.month)).toEqual([9]);
  });
  it("zero-day students still get a zero invoice; inactive students are skipped", async () => {
    const { c, s1, actor } = await setup();
    await prisma.student.update({ where: { id: s1.id }, data: { isActive: false } });
    const r = await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    expect(r.invoices).toBe(1);
    expect((await prisma.foodInvoice.findFirst())?.amount).toBe(0);
  });
  it("rejects already closed, future month, other teacher", async () => {
    const { c, actor } = await setup();
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    await expect(closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW)).rejects.toMatchObject({ code: "MONTH_ALREADY_CLOSED" });
    await expect(closeMonth(actor, { classId: c.id, year: "2026", month: "11" }, NOW)).rejects.toMatchObject({ code: "FUTURE_MONTH" });
    const t2 = await f.user("TEACHER");
    await expect(closeMonth(actorOf(t2), { classId: c.id, year: "2026", month: "10" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rate change after a close does not alter the old invoice", async () => {
    const { c, s1, actor } = await setup();
    await present(s1.id, 1);
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    await prisma.class.update({ where: { id: c.id }, data: { dailyFoodRate: 5000 } });
    await prisma.attendance.create({ data: { studentId: s1.id, date: dateOnly(2026, 10, 1), status: "PRESENT" } });
    await closeMonth(actor, { classId: c.id, year: "2026", month: "10" }, NOW);
    const inv = await prisma.foodInvoice.findMany({ where: { studentId: s1.id }, orderBy: { month: "asc" } });
    expect(inv.map((i) => i.amount)).toEqual([3000, 5000]);
  });
});

describe("reopenMonth", () => {
  it("admin reopens; invoices removed; attendance kept; blocked after a later payment", async () => {
    const { c, s1, actor, t } = await setup();
    const admin = await f.user("ADMIN");
    await present(s1.id, 1);
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    await expect(reopenMonth(actorOf(t), { classId: c.id, year: "2026", month: "9" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" });
    expect(await prisma.foodInvoice.count()).toBe(0);
    expect(await prisma.attendance.count()).toBe(1);
    await expect(reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" })).rejects.toMatchObject({ code: "MONTH_NOT_CLOSED" });

    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    const acc = await f.user("ACCOUNTANT");
    await prisma.payment.create({ data: { studentId: s1.id, kind: "FOOD", amount: 3000, paidAt: new Date(), registeredById: acc.id } });
    await expect(reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" })).rejects.toMatchObject({ code: "REOPEN_BLOCKED" });
  });
  it("a soft-deleted later payment does not block reopening", async () => {
    const { c, s1, actor } = await setup();
    const admin = await f.user("ADMIN");
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    const acc = await f.user("ACCOUNTANT");
    await prisma.payment.create({ data: { studentId: s1.id, kind: "FOOD", amount: 3000, paidAt: new Date(), registeredById: acc.id, deletedAt: new Date(), deleteReason: "x" } });
    await expect(reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" })).resolves.toBeUndefined();
  });
});
