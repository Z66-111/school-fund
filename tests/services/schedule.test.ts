import { describe, it, expect } from "vitest";
import { getSchedule, saveSchedule, slotKey, PERIODS } from "@/services/schedule";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

async function setup() {
  const t = await f.user("TEACHER");
  const c = await f.klass({ teacherId: t.id });
  return { t, c, actor: actorOf(t) };
}

describe("saveSchedule", () => {
  it("teacher saves subjects and times for own class; getSchedule returns 8 periods in order", async () => {
    const { c, actor } = await setup();
    await saveSchedule(actor, c.id, { "s-1-1": "Математик", "n-1-1": "201", "s-5-8": "Спорт", "start-1": "08:00", "end-1": "08:40", junk: "x" });
    const s = await getSchedule(actor, c.id);
    expect(s.periods).toHaveLength(PERIODS);
    expect(s.periods.map((p) => p.period)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.periods[0]).toEqual({ period: 1, startTime: "08:00", endTime: "08:40" });
    expect(s.periods[1]).toEqual({ period: 2, startTime: null, endTime: null });
    expect(s.slots[slotKey(1, 1)]).toEqual({ subject: "Математик", note: "201" });
    expect(s.slots[slotKey(5, 8)]).toEqual({ subject: "Спорт", note: "" });
    expect(Object.keys(s.slots)).toHaveLength(2);
  });
  it("replace-all: clearing a subject removes its row; a note without subject is dropped; times save alone", async () => {
    const { c, actor } = await setup();
    await saveSchedule(actor, c.id, { "s-1-1": "Математик", "s-2-2": "Монгол хэл" });
    await saveSchedule(actor, c.id, { "s-1-1": "", "n-1-1": "orphan note", "s-2-2": "Монгол хэл", "start-3": "10:00" });
    expect(await prisma.lessonSlot.count({ where: { classId: c.id } })).toBe(1);
    const s = await getSchedule(actor, c.id);
    expect(s.slots[slotKey(1, 1)]).toBeUndefined();
    expect(s.periods[2]).toEqual({ period: 3, startTime: "10:00", endTime: null });
    await saveSchedule(actor, c.id, { "start-1": "08:00", "end-1": "08:40" });
    expect(await prisma.lessonSlot.count({ where: { classId: c.id } })).toBe(0);
    expect(await prisma.periodTime.count({ where: { classId: c.id } })).toBe(1);
  });
  it("rejects bad time format, end before start, and over-long subject", async () => {
    const { c, actor } = await setup();
    await expect(saveSchedule(actor, c.id, { "start-1": "8:00" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveSchedule(actor, c.id, { "start-1": "09:00", "end-1": "08:30" })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { "end-1": expect.any(Array) } });
    await expect(saveSchedule(actor, c.id, { "s-1-1": "x".repeat(61) })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("authorization: other teacher and accountant forbidden; admin allowed; parent reads own child's class only", async () => {
    const { c, actor } = await setup();
    await saveSchedule(actor, c.id, { "s-1-1": "Математик" });
    const t2 = await f.user("TEACHER");
    await expect(saveSchedule(actorOf(t2), c.id, { "s-1-1": "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(saveSchedule(actorOf(acc), c.id, { "s-1-1": "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await f.user("ADMIN");
    await expect(saveSchedule(actorOf(admin), c.id, { "s-1-2": "Түүх" })).resolves.toBeUndefined();
    const p = await f.user("PARENT");
    const s = await f.student(c.id);
    await f.link(p.id, s.id);
    expect((await getSchedule(actorOf(p), c.id)).slots[slotKey(1, 2)]?.subject).toBe("Түүх");
    const other = await f.klass();
    await expect(getSchedule(actorOf(p), other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveSchedule(actorOf(p), c.id, { "s-1-1": "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
