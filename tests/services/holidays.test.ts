import { describe, it, expect } from "vitest";
import { addHoliday, deleteHoliday, listHolidays, holidayDates } from "@/services/holidays";
import { toISODate } from "@/lib/dates";
import { f, actorOf } from "../helpers/db";

describe("holidays", () => {
  it("admin adds within the year; outside rejected; duplicate rejected", async () => {
    const admin = await f.user("ADMIN");
    const y = await f.schoolYear();
    const h = await addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2026-11-26", name: "Тусгаар тогтнолын өдөр" });
    expect(toISODate(h.date)).toBe("2026-11-26");
    await expect(addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2025-01-01", name: "x" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2026-11-26", name: "dup" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("lists, exposes dates, deletes; teacher forbidden to add", async () => {
    const admin = await f.user("ADMIN");
    const y = await f.schoolYear();
    const h = await addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2026-12-31", name: "x" });
    expect((await listHolidays(y.id)).map((x) => x.id)).toEqual([h.id]);
    expect((await holidayDates(y.id)).map(toISODate)).toEqual(["2026-12-31"]);
    const t = await f.user("TEACHER");
    await expect(addHoliday(actorOf(t), { schoolYearId: y.id, date: "2026-12-30", name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteHoliday(actorOf(admin), h.id);
    expect(await listHolidays(y.id)).toEqual([]);
  });
});
