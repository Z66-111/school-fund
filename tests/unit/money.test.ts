import { describe, it, expect } from "vitest";
import { formatMNT, moneySchema } from "@/lib/money";

describe("formatMNT", () => {
  it("groups thousands and appends ₮", () => {
    expect(formatMNT(3000)).toBe("3,000 ₮");
    expect(formatMNT(1234567)).toBe("1,234,567 ₮");
    expect(formatMNT(0)).toBe("0 ₮");
  });
  it("formats negatives with a leading minus", () => {
    expect(formatMNT(-500)).toBe("-500 ₮");
  });
});

describe("moneySchema", () => {
  it("accepts positive integers from strings", () => {
    expect(moneySchema.parse("3000")).toBe(3000);
    expect(moneySchema.parse(3000)).toBe(3000);
  });
  it("rejects zero, negatives, decimals, empty", () => {
    for (const bad of ["0", "-1", "3.5", "", "abc"]) {
      expect(moneySchema.safeParse(bad).success).toBe(false);
    }
  });
});
