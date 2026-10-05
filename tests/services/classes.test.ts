import { describe, it, expect } from "vitest";
import { createClass, updateClassRates, assignTeacher, listClasses, getTeacherClass } from "@/services/classes";
import { f, actorOf } from "../helpers/db";

describe("classes", () => {
  it("admin creates with integer rates; validation on bad money", async () => {
    const admin = await f.user("ADMIN");
    const y = await f.schoolYear();
    const c = await createClass(actorOf(admin), { name: "1А", schoolYearId: y.id, dailyFoodRate: "3000", annualFundAmount: "50000" });
    expect(c.dailyFoodRate).toBe(3000);
    await expect(createClass(actorOf(admin), { name: "1Б", schoolYearId: y.id, dailyFoodRate: "3.5", annualFundAmount: "1" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createClass(actorOf(admin), { name: "1А", schoolYearId: y.id, dailyFoodRate: "1", annualFundAmount: "1" })).rejects.toMatchObject({ code: "VALIDATION" }); // unique
  });
  it("assigns only teachers; teacher role forbidden to assign", async () => {
    const admin = await f.user("ADMIN");
    const c = await f.klass();
    const t = await f.user("TEACHER");
    const p = await f.user("PARENT");
    await assignTeacher(actorOf(admin), c.id, t.id);
    expect((await getTeacherClass(t.id))?.id).toBe(c.id);
    await expect(assignTeacher(actorOf(admin), c.id, p.id)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(assignTeacher(actorOf(t), c.id, t.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await assignTeacher(actorOf(admin), c.id, null);
    expect(await getTeacherClass(t.id)).toBeNull();
  });
  it("getTeacherClass only returns the class in the active year", async () => {
    const t = await f.user("TEACHER");
    const old = await f.schoolYear({ isActive: false });
    await f.klass({ teacherId: t.id, schoolYearId: old.id });
    expect(await getTeacherClass(t.id)).toBeNull();
    const cur = await f.schoolYear({ isActive: true });
    const c = await f.klass({ teacherId: t.id, schoolYearId: cur.id });
    expect((await getTeacherClass(t.id))?.id).toBe(c.id);
  });
  it("updates rates and lists with student count", async () => {
    const admin = await f.user("ADMIN");
    const c = await f.klass();
    await f.student(c.id);
    await updateClassRates(actorOf(admin), c.id, { dailyFoodRate: "3500", annualFundAmount: "60000" });
    const list = await listClasses(c.schoolYearId);
    expect(list[0].dailyFoodRate).toBe(3500);
    expect(list[0]._count.students).toBe(1);
  });
});
