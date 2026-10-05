import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { f } from "../helpers/db";
import { verifyPassword } from "@/lib/password";

describe("db + factories", () => {
  it("creates a user with a verifiable password hash", async () => {
    const u = await f.user("ADMIN", { password: "pw" });
    expect(await verifyPassword("pw", u.passwordHash)).toBe(true);
    expect(await verifyPassword("nope", u.passwordHash)).toBe(false);
  });
  it("resets between tests", async () => {
    expect(await prisma.user.count()).toBe(0);
  });
  it("enforces unique attendance per student per day", async () => {
    const c = await f.klass();
    const s = await f.student(c.id);
    const d = new Date("2026-10-05T00:00:00Z");
    await prisma.attendance.create({ data: { studentId: s.id, date: d, status: "PRESENT" } });
    await expect(prisma.attendance.create({ data: { studentId: s.id, date: d, status: "ABSENT" } })).rejects.toThrow();
  });
});
