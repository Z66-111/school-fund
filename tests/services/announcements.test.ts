import { describe, it, expect } from "vitest";
import { getAnnouncement, saveAnnouncement, announcementsForParent, ANNOUNCEMENT_MAX } from "@/services/announcements";
import { f, actorOf } from "../helpers/db";

async function setup() {
  const t = await f.user("TEACHER");
  const c = await f.klass({ teacherId: t.id });
  return { t, c, actor: actorOf(t) };
}

describe("announcements", () => {
  it("teacher sets, replaces and clears the class announcement; whitespace collapses to one line", async () => {
    const { c, actor } = await setup();
    expect(await getAnnouncement(actor, c.id)).toBeNull();
    expect(await saveAnnouncement(actor, c.id, "  Баасан гарагт\n хурал   болно ")).toBe(true);
    const a = await getAnnouncement(actor, c.id);
    expect(a).toMatchObject({ classId: c.id, className: c.name, text: "Баасан гарагт хурал болно" });
    expect(a?.at).toBeInstanceOf(Date);
    await saveAnnouncement(actor, c.id, "Шинэ зарлал");
    expect((await getAnnouncement(actor, c.id))?.text).toBe("Шинэ зарлал");
    expect(await saveAnnouncement(actor, c.id, "   ")).toBe(false);
    expect(await getAnnouncement(actor, c.id)).toBeNull();
  });
  it("rejects text over the limit and a missing classId", async () => {
    const { c, actor } = await setup();
    await expect(saveAnnouncement(actor, c.id, "x".repeat(ANNOUNCEMENT_MAX + 1))).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { text: expect.any(Array) } });
    await expect(saveAnnouncement(actor, c.id, "x".repeat(ANNOUNCEMENT_MAX))).resolves.toBe(true);
    await expect(saveAnnouncement(actor, "", "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("authorization: other teacher, accountant and parent cannot write; admin can", async () => {
    const { c } = await setup();
    await expect(saveAnnouncement(actorOf(await f.user("TEACHER")), c.id, "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveAnnouncement(actorOf(await f.user("ACCOUNTANT")), c.id, "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const p = await f.user("PARENT");
    await f.link(p.id, (await f.student(c.id)).id);
    await expect(saveAnnouncement(actorOf(p), c.id, "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveAnnouncement(actorOf(await f.user("ADMIN")), c.id, "Админы зарлал")).resolves.toBe(true);
  });
  it("a parent sees announcements only from their own children's classes, once per class, and none when cleared", async () => {
    const { c, actor } = await setup();
    const other = await f.klass();
    const empty = await f.klass();
    const admin = actorOf(await f.user("ADMIN"));
    await saveAnnouncement(actor, c.id, "Манай ангийн зарлал");
    await saveAnnouncement(admin, other.id, "Өөр ангийн зарлал");
    const p = await f.user("PARENT");
    await f.link(p.id, (await f.student(c.id)).id);
    await f.link(p.id, (await f.student(c.id)).id);
    await f.link(p.id, (await f.student(empty.id)).id);
    const seen = await announcementsForParent(actorOf(p));
    expect(seen.map((a) => a.text)).toEqual(["Манай ангийн зарлал"]);
    expect(await announcementsForParent(actorOf(await f.user("PARENT")))).toEqual([]);
    await saveAnnouncement(actor, c.id, "");
    expect(await announcementsForParent(actorOf(p))).toEqual([]);
    await expect(announcementsForParent(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
