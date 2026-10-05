import { describe, it, expect } from "vitest";
import { registerPayment, deletePayment, listPayments, listAllPayments, studentBalances, outstandingTable } from "@/services/payments";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z");

async function setup() {
  const acc = await f.user("ACCOUNTANT");
  const t = await f.user("TEACHER");
  const y = await f.schoolYear({ isActive: true });
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id, dailyFoodRate: 3000, annualFundAmount: 50000, name: "1А" });
  const s = await f.student(c.id, { name: "Бат" });
  const close = await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
  await prisma.foodInvoice.create({ data: { studentId: s.id, monthCloseId: close.id, year: 2026, month: 9, daysPresent: 15, rate: 3000, amount: 45000 } });
  return { acc, t, y, c, s, actor: actorOf(acc) };
}

describe("registerPayment", () => {
  it("accountant registers; teacher/admin/parent forbidden; future date and bad amount rejected", async () => {
    const { s, actor, t } = await setup();
    const p = await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "20000", paidAt: "2026-10-01", note: "Хаан банк 123" }, NOW);
    expect(p.amount).toBe(20000);
    await expect(registerPayment(actorOf(t), { studentId: s.id, kind: "FOOD", amount: "1", paidAt: "2026-10-01" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "1", paidAt: "2026-10-21" }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "-5", paidAt: "2026-10-01" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(registerPayment(actor, { studentId: s.id, kind: "GIFT", amount: "5", paidAt: "2026-10-01" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("studentBalances", () => {
  it("allocates food payments oldest first and computes fund due", async () => {
    const { s, actor } = await setup();
    await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "20000", paidAt: "2026-10-01" }, NOW);
    await registerPayment(actor, { studentId: s.id, kind: "ANNUAL_FUND", amount: "30000", paidAt: "2026-10-01" }, NOW);
    const b = await studentBalances(actor, s.id);
    expect(b).toMatchObject({ foodInvoiced: 45000, foodPaid: 20000, foodOutstanding: 25000, foodCredit: 0, fundPaid: 30000, fundDue: 20000, annualFundAmount: 50000 });
    expect(b.invoices[0]).toMatchObject({ paid: 20000, outstanding: 25000 });
  });
  it("overpayment shows credit and zero outstanding", async () => {
    const { s, actor } = await setup();
    await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "50000", paidAt: "2026-10-01" }, NOW);
    const b = await studentBalances(actor, s.id);
    expect(b).toMatchObject({ foodOutstanding: 0, foodCredit: 5000 });
  });
  it("parent can read own child's balances, not another's", async () => {
    const { s, c } = await setup();
    const p = await f.user("PARENT");
    await f.link(p.id, s.id);
    await expect(studentBalances(actorOf(p), s.id)).resolves.toBeTruthy();
    const other = await f.student(c.id);
    await expect(studentBalances(actorOf(p), other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("deletePayment", () => {
  it("soft deletes own payment with reason; excluded from sums; other accountant cannot", async () => {
    const { s, actor } = await setup();
    const p = await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "20000", paidAt: "2026-10-01" }, NOW);
    const acc2 = await f.user("ACCOUNTANT");
    await expect(deletePayment(actorOf(acc2), { paymentId: p.id, reason: "x" })).rejects.toMatchObject({ code: "NOT_OWN_PAYMENT" });
    await expect(deletePayment(actor, { paymentId: p.id, reason: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await deletePayment(actor, { paymentId: p.id, reason: "Буруу сурагч" });
    expect((await studentBalances(actor, s.id)).foodPaid).toBe(0);
    expect(await listPayments(actor, s.id)).toEqual([]);
    const all = await listAllPayments(actor);
    expect(all[0].deleteReason).toBe("Буруу сурагч");
  });
});

describe("outstandingTable", () => {
  it("lists active-year students with dues; inactive only when food is owed; class filter", async () => {
    const { s, c, actor } = await setup();
    const s2 = await f.student(c.id, { name: "Сарнай" }); // no invoice, owes fund only
    const inactivePaid = await f.student(c.id, { isActive: false }); // nothing owed -> hidden
    const inactiveOwing = await f.student(c.id, { isActive: false, name: "Явсан" });
    const close = await prisma.monthClose.findFirstOrThrow();
    await prisma.foodInvoice.create({ data: { studentId: inactiveOwing.id, monthCloseId: close.id, year: 2026, month: 9, daysPresent: 1, rate: 3000, amount: 3000 } });
    const otherClass = await f.klass({ schoolYearId: c.schoolYearId, name: "2Б" });
    await f.student(otherClass.id);

    const rows = await outstandingTable(actor);
    const byId = Object.fromEntries(rows.map((r) => [r.studentId, r]));
    expect(byId[s.id]).toMatchObject({ foodDue: 45000, fundDue: 50000, className: "1А" });
    expect(byId[s2.id]).toMatchObject({ foodDue: 0, fundDue: 50000 });
    expect(byId[inactivePaid.id]).toBeUndefined();
    expect(byId[inactiveOwing.id]).toMatchObject({ foodDue: 3000, fundDue: 0, isActive: false });
    expect(rows).toHaveLength(4);
    expect((await outstandingTable(actor, otherClass.id))).toHaveLength(1);
  });
});
