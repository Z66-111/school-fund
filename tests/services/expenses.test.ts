import { describe, it, expect } from "vitest";
import { addExpense, updateExpense, deleteExpense, listExpenses } from "@/services/expenses";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z");

async function setup() {
  const t = await f.user("TEACHER");
  const c = await f.klass({ teacherId: t.id });
  return { t, c, actor: actorOf(t) };
}

describe("expenses", () => {
  it("teacher adds to own class; schoolYear copied; future and bad amount rejected", async () => {
    const { c, actor } = await setup();
    const e = await addExpense(actor, { classId: c.id, date: "2026-10-10", title: "Ус", amount: "12000", note: "20л x 2" }, NOW);
    expect(e.schoolYearId).toBe(c.schoolYearId);
    await expect(addExpense(actor, { classId: c.id, date: "2026-10-21", title: "x", amount: "1" }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(addExpense(actor, { classId: c.id, date: "2026-10-10", title: "", amount: "1" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addExpense(actor, { classId: c.id, date: "2026-10-10", title: "x", amount: "0" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("other teacher and accountant cannot add or delete; admin can delete", async () => {
    const { c, actor } = await setup();
    const e = await addExpense(actor, { classId: c.id, date: "2026-10-10", title: "Ус", amount: "12000" }, NOW);
    const t2 = await f.user("TEACHER");
    await expect(addExpense(actorOf(t2), { classId: c.id, date: "2026-10-10", title: "x", amount: "1" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteExpense(actorOf(t2), e.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(addExpense(actorOf(acc), { classId: c.id, date: "2026-10-10", title: "x", amount: "1" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await f.user("ADMIN");
    await deleteExpense(actorOf(admin), e.id);
    expect(await listExpenses(actorOf(admin), c.id)).toEqual([]);
  });
  it("updates and lists newest first; parent can list own child's class", async () => {
    const { c, actor } = await setup();
    const a = await addExpense(actor, { classId: c.id, date: "2026-10-01", title: "A", amount: "100" }, NOW);
    await addExpense(actor, { classId: c.id, date: "2026-10-05", title: "B", amount: "200" }, NOW);
    await updateExpense(actor, a.id, { date: "2026-10-02", title: "A2", amount: "150" }, NOW);
    const list = await listExpenses(actor, c.id);
    expect(list.map((e) => e.title)).toEqual(["B", "A2"]);
    expect(list[1].amount).toBe(150);
    const p = await f.user("PARENT");
    const s = await f.student(c.id);
    await f.link(p.id, s.id);
    expect(await listExpenses(actorOf(p), c.id)).toHaveLength(2);
  });
});
