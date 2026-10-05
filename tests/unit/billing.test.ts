import { describe, it, expect } from "vitest";
import { chargeableDates, isChargeable, countPresentDays, invoiceAmount, allocateFoodPayments, foodOutstanding, foodCredit, fundBalance } from "@/lib/billing";
import { dateOnly, toISODate } from "@/lib/dates";

describe("chargeable days", () => {
  it("excludes weekends and holidays", () => {
    // Oct 2026: 31 days, 22 weekdays. Make Oct 5 (Mon) a holiday.
    const d = chargeableDates(2026, 10, [dateOnly(2026, 10, 5)]);
    expect(d).toHaveLength(21);
    expect(d.map(toISODate)).not.toContain("2026-10-05");
    expect(d.map(toISODate)).not.toContain("2026-10-03");
  });
  it("isChargeable", () => {
    expect(isChargeable(dateOnly(2026, 10, 5), [])).toBe(true);
    expect(isChargeable(dateOnly(2026, 10, 5), [dateOnly(2026, 10, 5)])).toBe(false);
    expect(isChargeable(dateOnly(2026, 10, 4), [])).toBe(false);
  });
});

describe("countPresentDays", () => {
  it("counts PRESENT on chargeable days only; unmarked is absent", () => {
    const rows = [
      { date: dateOnly(2026, 10, 1), status: "PRESENT" },
      { date: dateOnly(2026, 10, 2), status: "ABSENT" },
      { date: dateOnly(2026, 10, 3), status: "PRESENT" }, // Saturday, ignored
      { date: dateOnly(2026, 10, 5), status: "PRESENT" }, // holiday, ignored
      { date: dateOnly(2026, 11, 2), status: "PRESENT" }, // other month
    ];
    expect(countPresentDays(rows, 2026, 10, [dateOnly(2026, 10, 5)])).toBe(1);
    expect(countPresentDays([], 2026, 10, [])).toBe(0);
  });
});

describe("invoiceAmount", () => {
  it("multiplies", () => {
    expect(invoiceAmount(18, 3000)).toBe(54000);
    expect(invoiceAmount(0, 3000)).toBe(0);
  });
});

describe("allocateFoodPayments", () => {
  const inv = [
    { id: "b", year: 2026, month: 10, amount: 30000 },
    { id: "a", year: 2026, month: 9, amount: 45000 },
  ];
  it("applies oldest first, partial on the next", () => {
    const r = allocateFoodPayments(inv, 50000);
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r[0]).toMatchObject({ paid: 45000, outstanding: 0 });
    expect(r[1]).toMatchObject({ paid: 5000, outstanding: 25000 });
  });
  it("overpayment marks all paid and never goes negative", () => {
    const r = allocateFoodPayments(inv, 100000);
    expect(r.every((x) => x.outstanding === 0)).toBe(true);
    expect(r[1].paid).toBe(30000);
    expect(foodOutstanding(75000, 100000)).toBe(0);
    expect(foodCredit(75000, 100000)).toBe(25000);
    expect(foodCredit(75000, 50000)).toBe(0);
  });
  it("zero paid leaves everything outstanding", () => {
    const r = allocateFoodPayments(inv, 0);
    expect(r.map((x) => x.outstanding)).toEqual([45000, 30000]);
    expect(foodOutstanding(75000, 0)).toBe(75000);
  });
});

describe("fundBalance", () => {
  it("collected minus spent, may be negative", () => {
    expect(fundBalance(100000, 40000)).toBe(60000);
    expect(fundBalance(10000, 40000)).toBe(-30000);
  });
});
