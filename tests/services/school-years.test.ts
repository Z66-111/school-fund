import { describe, it, expect } from "vitest";
import { createSchoolYear, activateSchoolYear, listSchoolYears, getActiveSchoolYear } from "@/services/school-years";
import { f, actorOf } from "../helpers/db";

describe("school years", () => {
  it("admin creates; others forbidden", async () => {
    const admin = await f.user("ADMIN");
    const y = await createSchoolYear(actorOf(admin), { name: "2026-2027", startDate: "2026-09-01", endDate: "2027-06-01" });
    expect(y.isActive).toBe(false);
    const t = await f.user("TEACHER");
    await expect(createSchoolYear(actorOf(t), { name: "x", startDate: "2026-09-01", endDate: "2027-06-01" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects end before start and bad dates", async () => {
    const admin = await f.user("ADMIN");
    await expect(createSchoolYear(actorOf(admin), { name: "x", startDate: "2027-09-01", endDate: "2026-06-01" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createSchoolYear(actorOf(admin), { name: "x", startDate: "bad", endDate: "2026-06-01" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("activating one deactivates the others", async () => {
    const admin = await f.user("ADMIN");
    const a = await f.schoolYear({ isActive: true });
    const b = await f.schoolYear({ isActive: false });
    await activateSchoolYear(actorOf(admin), b.id);
    const list = await listSchoolYears();
    expect(list.find((y) => y.id === a.id)?.isActive).toBe(false);
    expect(list.find((y) => y.id === b.id)?.isActive).toBe(true);
    expect((await getActiveSchoolYear()).id).toBe(b.id);
  });
  it("getActiveSchoolYear throws when none", async () => {
    await expect(getActiveSchoolYear()).rejects.toMatchObject({ code: "NO_ACTIVE_YEAR" });
  });
});
