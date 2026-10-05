import { describe, it, expect } from "vitest";
import { requireRole, assertClassAccess, assertStudentAccess } from "@/lib/authz";
import { f, actorOf } from "../helpers/db";

describe("requireRole", () => {
  it("passes for allowed role and throws for others", () => {
    expect(() => requireRole({ userId: "x", role: "ADMIN" }, "ADMIN", "TEACHER")).not.toThrow();
    expect(() => requireRole({ userId: "x", role: "PARENT" }, "ADMIN")).toThrow(/Хандах эрхгүй/);
  });
});

describe("class and student access", () => {
  it("teacher can access own class only", async () => {
    const t = await f.user("TEACHER");
    const mine = await f.klass({ teacherId: t.id });
    const other = await f.klass();
    await expect(assertClassAccess(actorOf(t), mine.id)).resolves.toBeUndefined();
    await expect(assertClassAccess(actorOf(t), other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("admin and accountant can access any class", async () => {
    const c = await f.klass();
    for (const role of ["ADMIN", "ACCOUNTANT"] as const) {
      const u = await f.user(role);
      await expect(assertClassAccess(actorOf(u), c.id)).resolves.toBeUndefined();
    }
  });
  it("parent with children in two classes can read both, not a third", async () => {
    const p = await f.user("PARENT");
    const c1 = await f.klass();
    const c2 = await f.klass();
    const c3 = await f.klass();
    const s1 = await f.student(c1.id);
    const s2 = await f.student(c2.id);
    const s3 = await f.student(c3.id);
    await f.link(p.id, s1.id);
    await f.link(p.id, s2.id);
    await expect(assertClassAccess(actorOf(p), c1.id)).resolves.toBeUndefined();
    await expect(assertClassAccess(actorOf(p), c2.id)).resolves.toBeUndefined();
    await expect(assertClassAccess(actorOf(p), c3.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertStudentAccess(actorOf(p), s1.id)).resolves.toMatchObject({ classId: c1.id });
    await expect(assertStudentAccess(actorOf(p), s3.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("missing class or student is NOT_FOUND", async () => {
    const a = await f.user("ADMIN");
    await expect(assertClassAccess(actorOf(a), "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assertStudentAccess(actorOf(a), "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
