import { describe, it, expect } from "vitest";
import { chargeableDates, isChargeable, countPresentDays, invoiceAmount, allocateFoodPayments, foodOutstanding, foodCredit, fundBalance, daycareCharges, daycareCells } from "@/lib/billing";
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

describe("prepaid Өдөр өнжүүлэх charges", () => {
  // No holidays: Sep 2026 has 22 school days, Oct 22, Nov 21, Dec 23.
  const RATE = 27000;
  const d = (m: number, day: number) => dateOnly(2026, m, day);
  const run = (o: Partial<Parameters<typeof daycareCharges>[0]> = {}) =>
    daycareCharges({
      from: d(9, 1), until: null, yearStart: d(9, 1), yearEnd: dateOnly(2027, 6, 1), today: d(10, 20),
      holidays: [], skips: [], rate: RATE, closedMonths: new Set(), frozen: [], ...o,
    }).map((c) => [c.month, c.daysPresent, c.deductedDays, c.amount, c.provisional]);

  it("charges every started month in full, including the current one", () => {
    expect(run()).toEqual([[9, 22, 0, 594000, true], [10, 22, 0, 594000, true]]);
    expect(run({ today: d(11, 1) }).map((r) => r[0])).toEqual([9, 10, 11]); // due from the 1st, even a Sunday
  });
  it("skipped days do not change that month; they come off the next month", () => {
    expect(run({ skips: [d(9, 3), d(9, 4), d(9, 7)] })).toEqual([[9, 22, 0, 594000, true], [10, 22, 3, 513000, true]]);
    expect(run({ skips: [d(10, 5), d(10, 6)] })).toEqual([[9, 22, 0, 594000, true], [10, 22, 0, 594000, true]]);
    expect(run({ skips: [d(10, 5), d(10, 6)], today: d(11, 2) })[2]).toEqual([11, 21, 2, 513000, true]);
  });
  it("ignores skips on weekends, holidays and days outside the enrolment", () => {
    expect(run({ from: d(9, 14), holidays: [d(9, 15)], skips: [d(9, 5), d(9, 10), d(9, 15), d(9, 16)] })).toEqual([
      [9, 12, 0, 324000, true], // Sep 14-30 less the holiday
      [10, 22, 1, 567000, true], // only Sep 16 counts
    ]);
  });
  it("a first or last month is charged only for the days inside the enrolment", () => {
    expect(run({ from: d(10, 15) })).toEqual([[10, 12, 0, 324000, true]]);
    expect(run({ until: d(10, 9), today: d(12, 1) })).toEqual([[9, 22, 0, 594000, true], [10, 7, 0, 189000, true]]);
    expect(run({ from: d(11, 2) })).toEqual([]); // not started yet
    expect(run({ from: d(8, 1), yearEnd: d(9, 30), today: d(12, 1) })).toEqual([[9, 22, 0, 594000, true]]); // bounded by the school year
  });
  it("never goes below zero: what a short month cannot absorb carries to the month after", () => {
    const holidays = Array.from({ length: 26 }, (_, i) => d(10, 5 + i)); // Oct keeps only the 1st and 2nd
    const skips = [d(9, 1), d(9, 2), d(9, 3), d(9, 4), d(9, 7)];
    expect(run({ holidays, skips, today: d(11, 5) })).toEqual([
      [9, 22, 0, 594000, true],
      [10, 2, 2, 0, true],
      [11, 21, 3, 486000, true],
    ]);
  });
  it("closed months are frozen and returned untouched; their skips still reduce the next open month", () => {
    const sep = { id: "inv-sep", year: 2026, month: 9, daysPresent: 22, deductedDays: 0, rate: RATE, amount: 594000, provisional: false };
    const got = daycareCharges({
      from: d(9, 1), until: null, yearStart: d(9, 1), yearEnd: dateOnly(2027, 6, 1), today: d(10, 20),
      holidays: [], skips: [d(9, 3), d(9, 4)], rate: 30000, closedMonths: new Set(["2026-9"]), frozen: [sep],
    });
    expect(got[0]).toBe(sep);
    expect(got[1]).toMatchObject({ month: 10, daysPresent: 22, deductedDays: 2, rate: 30000, amount: 600000, provisional: true });
    // A closed month with no invoice was never charged, so its skipped days give nothing back.
    expect(run({ skips: [d(9, 3)], closedMonths: new Set(["2026-9"]) })).toEqual([[10, 22, 0, 594000, true]]);
  });
  it("grid cells: enrolled school days start as stayed, skipped ones are marked, other days have no cell", () => {
    const days = [d(10, 1), d(10, 2), d(10, 3), d(10, 5), d(10, 6)].map((x) => ({ iso: toISODate(x), chargeable: x.getUTCDay() !== 6 }));
    const cells = daycareCells({ id: "s", daycareFrom: d(10, 2), daycareUntil: d(10, 5) }, days, new Set(["s|2026-10-05"]));
    expect(cells).toEqual({ "s|2026-10-02": "STAYED", "s|2026-10-05": "SKIPPED" });
    expect(daycareCells({ id: "s", daycareFrom: null, daycareUntil: null }, days, new Set())).toEqual({});
  });
});
