import { describe, it, expect } from "vitest";
import { createUser, resetPassword, listUsers } from "@/services/users";
import { authenticate } from "@/services/auth";
import { f, actorOf } from "../helpers/db";

describe("users", () => {
  it("admin creates any role; email normalized; duplicate rejected", async () => {
    const admin = await f.user("ADMIN");
    const u = await createUser(actorOf(admin), { name: "T", email: " New@X.mn ", password: "pw1234", role: "TEACHER" });
    expect(u.email).toBe("new@x.mn");
    await expect(createUser(actorOf(admin), { name: "T2", email: "new@x.mn", password: "pw1234", role: "TEACHER" })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });
  it("teacher may only create PARENT; accountant none", async () => {
    const t = await f.user("TEACHER");
    await expect(createUser(actorOf(t), { name: "P", email: "p@x.mn", password: "pw1234", role: "PARENT" })).resolves.toBeTruthy();
    await expect(createUser(actorOf(t), { name: "A", email: "a@x.mn", password: "pw1234", role: "ADMIN" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(createUser(actorOf(acc), { name: "P", email: "p2@x.mn", password: "pw1234", role: "PARENT" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects short password", async () => {
    const admin = await f.user("ADMIN");
    await expect(createUser(actorOf(admin), { name: "P", email: "p@x.mn", password: "123", role: "PARENT" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("admin resets password; new password works", async () => {
    const admin = await f.user("ADMIN");
    const u = await f.user("PARENT", { email: "p@x.mn", password: "old123" });
    await resetPassword(actorOf(admin), u.id, "new123");
    await expect(authenticate("p@x.mn", "new123")).resolves.toBeTruthy();
    await expect(authenticate("p@x.mn", "old123")).rejects.toBeTruthy();
    expect((await listUsers("PARENT")).map((x) => x.id)).toEqual([u.id]);
  });
});
