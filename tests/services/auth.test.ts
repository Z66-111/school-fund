import { describe, it, expect } from "vitest";
import { authenticate } from "@/services/auth";
import { f } from "../helpers/db";

describe("authenticate", () => {
  it("returns id and role for correct credentials", async () => {
    const u = await f.user("TEACHER", { email: "t@x.mn", password: "pw1234" });
    const r = await authenticate("t@x.mn", "pw1234");
    expect(r).toEqual({ id: u.id, role: "TEACHER" });
  });
  it("normalizes email case and whitespace", async () => {
    await f.user("PARENT", { email: "parent@x.mn", password: "pw1234" });
    const r = await authenticate("  Parent@X.MN ", "pw1234");
    expect(r.role).toBe("PARENT");
  });
  it("rejects wrong password and unknown email with the same error", async () => {
    await f.user("PARENT", { email: "p@x.mn", password: "pw1234" });
    await expect(authenticate("p@x.mn", "bad")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(authenticate("nobody@x.mn", "pw1234")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});
