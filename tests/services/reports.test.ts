import { describe, it, expect } from "vitest";
import { classFundReport, monthlyFoodReport } from "@/services/reports";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

async function setup() {
  const t = await f.user("TEACHER");
  const acc = await f.user("ACCOUNTANT");
  const y = await f.schoolYear();
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id, annualFundAmount: 50000, name: "1А" });
  const s1 = await f.student(c.id, { name: "А" });
  const s2 = await f.student(c.id, { name: "Б" });
  const pay = (studentId: string, kind: string, amount: number) =>
    prisma.payment.create({ data: { studentId, kind, amount, paidAt: new Date("2026-10-01T00:00:00Z"), registeredById: acc.id } });
  return { t, acc, y, c, s1, s2, pay, actor: actorOf(t) };
}

describe("classFundReport", () => {
  it("sums contributions and expenses; excludes deleted payments", async () => {
    const { c, s1, s2, pay, actor, t, acc } = await setup();
    await pay(s1.id, "ANNUAL_FUND", 50000);
    await pay(s2.id, "ANNUAL_FUND", 20000);
    await pay(s2.id, "FOOD", 999); // not fund
    await prisma.payment.create({ data: { studentId: s2.id, kind: "ANNUAL_FUND", amount: 5000, paidAt: new Date(), registeredById: acc.id, deletedAt: new Date(), deleteReason: "x" } });
    await prisma.expense.create({ data: { classId: c.id, schoolYearId: c.schoolYearId, date: new Date("2026-10-02T00:00:00Z"), title: "Ус", amount: 12000, createdById: t.id } });
    const r = await classFundReport(actor, c.id);
    expect(r).toMatchObject({ className: "1А", collected: 70000, spent: 12000, balance: 58000 });
    expect(r.contributions.map((x) => [x.name, x.paid, x.due])).toEqual([["А", 50000, 0], ["Б", 20000, 30000]]);
  });
  it("parent of a child in the class can read; unrelated parent cannot", async () => {
    const { c, s1 } = await setup();
    const p = await f.user("PARENT");
    await f.link(p.id, s1.id);
    await expect(classFundReport(actorOf(p), c.id)).resolves.toBeTruthy();
    const p2 = await f.user("PARENT");
    await expect(classFundReport(actorOf(p2), c.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("monthlyFoodReport", () => {
  it("shows per-student invoice, allocated paid and outstanding; totals", async () => {
    const { c, s1, s2, pay, actor, t, acc } = await setup();
    const sep = await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
    const oct = await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 10, closedById: t.id } });
    await prisma.foodInvoice.create({ data: { studentId: s1.id, monthCloseId: sep.id, year: 2026, month: 9, daysPresent: 10, rate: 3000, amount: 30000 } });
    await prisma.foodInvoice.create({ data: { studentId: s1.id, monthCloseId: oct.id, year: 2026, month: 10, daysPresent: 5, rate: 3000, amount: 15000 } });
    await prisma.foodInvoice.create({ data: { studentId: s2.id, monthCloseId: oct.id, year: 2026, month: 10, daysPresent: 4, rate: 3000, amount: 12000 } });
    await pay(s1.id, "FOOD", 35000); // 30000 -> Sep, 5000 -> Oct
    const r = await monthlyFoodReport(actor, c.id, 2026, 10);
    expect(r.closed).toBe(true);
    expect(r.rows.map((x) => [x.name, x.daysPresent, x.amount, x.paid, x.outstanding])).toEqual([["А", 5, 15000, 5000, 10000], ["Б", 4, 12000, 0, 12000]]);
    expect(r.totals).toEqual({ amount: 27000, paid: 5000, outstanding: 22000 });
    expect((await monthlyFoodReport(actorOf(acc), c.id, 2026, 11)).closed).toBe(false);
    const p = await f.user("PARENT");
    await expect(monthlyFoodReport(actorOf(p), c.id, 2026, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });  it("DAYCARE kind reads daycare invoices and daycare payments only", async () => {
    const { c, s1, pay, actor, t } = await setup();
    const oct = await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 10, closedById: t.id } });
    await prisma.foodInvoice.create({ data: { studentId: s1.id, monthCloseId: oct.id, year: 2026, month: 10, daysPresent: 2, rate: 3000, amount: 6000 } });
    await prisma.daycareInvoice.create({ data: { studentId: s1.id, monthCloseId: oct.id, year: 2026, month: 10, daysPresent: 2, rate: 27000, amount: 54000 } });
    await pay(s1.id, "FOOD", 6000);
    await pay(s1.id, "DAYCARE", 20000);
    const r = await monthlyFoodReport(actor, c.id, 2026, 10, "DAYCARE");
    expect(r.kind).toBe("DAYCARE");
    expect(r.rows.map((x) => [x.amount, x.paid, x.outstanding])).toEqual([[54000, 20000, 34000]]);
  });
});
