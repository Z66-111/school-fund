import { describe, it, expect } from "vitest";
import { dateOnly, parseDateOnly, toISODate, isWeekend, daysInMonth, monthDates, todayDate, isFuture } from "@/lib/dates";

describe("dates", () => {
  it("dateOnly builds UTC midnight", () => {
    expect(dateOnly(2026, 10, 5).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("parseDateOnly round-trips and rejects junk", () => {
    expect(toISODate(parseDateOnly("2026-02-28"))).toBe("2026-02-28");
    expect(() => parseDateOnly("2026-2-8")).toThrow();
    expect(() => parseDateOnly("2026-13-01")).toThrow();
    expect(() => parseDateOnly("2026-02-30")).toThrow();
  });
  it("isWeekend", () => {
    expect(isWeekend(dateOnly(2026, 10, 3))).toBe(true); // Saturday
    expect(isWeekend(dateOnly(2026, 10, 4))).toBe(true); // Sunday
    expect(isWeekend(dateOnly(2026, 10, 5))).toBe(false); // Monday
  });
  it("daysInMonth and monthDates", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    const d = monthDates(2026, 10);
    expect(d).toHaveLength(31);
    expect(toISODate(d[0])).toBe("2026-10-01");
    expect(toISODate(d[30])).toBe("2026-10-31");
  });
  it("todayDate uses Ulaanbaatar offset", () => {
    // 2026-10-05 20:00 UTC is already 2026-10-06 in UB
    expect(toISODate(todayDate(new Date("2026-10-05T20:00:00Z")))).toBe("2026-10-06");
    expect(toISODate(todayDate(new Date("2026-10-05T10:00:00Z")))).toBe("2026-10-05");
  });
  it("isFuture compares against UB today", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(isFuture(dateOnly(2026, 10, 6), now)).toBe(true);
    expect(isFuture(dateOnly(2026, 10, 5), now)).toBe(false);
  });
});
