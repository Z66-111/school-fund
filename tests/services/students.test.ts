import { describe, it, expect } from "vitest";
import { addStudent, setStudentActive, deleteStudent, linkParent, createParentForStudent, listStudents, listChildren, setDaycareEnrollment } from "@/services/students";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

async function setup() {
  const t = await f.user("TEACHER");
  const c = await f.klass({ teacherId: t.id });
  return { t, c, actor: actorOf(t) };
}

describe("students", () => {
  it("teacher adds to own class; not to another; accountant forbidden", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" }, new Date("2026-10-20T20:00:00Z")); // already the 21st in Ulaanbaatar
    expect(s.isActive).toBe(true);
    expect([s.daycareFrom?.toISOString().slice(0, 10), s.daycareUntil]).toEqual(["2026-10-21", null]); // enrolled in daycare by default
    const other = await f.klass();
    await expect(addStudent(actor, { classId: other.id, name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(addStudent(actorOf(acc), { classId: c.id, name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("delete blocked when records exist; deactivate works; list filters inactive", async () => {
    const { c, actor, t } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    await prisma.payment.create({ data: { studentId: s.id, kind: "ANNUAL_FUND", amount: 1000, paidAt: new Date(), registeredById: t.id } });
    await expect(deleteStudent(actor, s.id)).rejects.toMatchObject({ code: "STUDENT_HAS_RECORDS" });
    await setStudentActive(actor, s.id, false);
    expect(await listStudents(c.id)).toEqual([]);
    expect((await listStudents(c.id, true)).map((x) => x.id)).toEqual([s.id]);
  });
  it("delete allowed without records", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    await prisma.attendance.create({ data: { studentId: s.id, date: new Date("2026-10-05T00:00:00Z"), status: "PRESENT" } });
    await deleteStudent(actor, s.id);
    expect(await prisma.student.count()).toBe(0);
  });
  it("links existing parent by email ignoring case; rejects non-parent and unknown", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    const p = await f.user("PARENT", { email: "mom@x.mn" });
    await linkParent(actor, { studentId: s.id, email: " MOM@x.MN " });
    expect((await listChildren(p.id)).map((x) => x.id)).toEqual([s.id]);
    await linkParent(actor, { studentId: s.id, email: "mom@x.mn" }); // idempotent
    const other = await f.user("TEACHER", { email: "t2@x.mn" });
    await expect(linkParent(actor, { studentId: s.id, email: other.email })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(linkParent(actor, { studentId: s.id, email: "ghost@x.mn" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("creates a parent account and links it", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    const p = await createParentForStudent(actor, { studentId: s.id, name: "Ээж", email: "mom@x.mn", password: "pw1234" });
    expect(p.role).toBe("PARENT");
    const list = await listStudents(c.id);
    expect(list[0].parents[0].parent.email).toBe("mom@x.mn");
  });
  it("daycare enrolment: sets a start and optional end, validates the order, clears with an empty start", async () => {
    const { c, actor } = await setup();
    const s = await f.student(c.id);
    const get = () => prisma.student.findUniqueOrThrow({ where: { id: s.id }, select: { daycareFrom: true, daycareUntil: true } });
    const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
    await setDaycareEnrollment(actor, { studentId: s.id, from: "2026-10-01", until: "" });
    expect([iso((await get()).daycareFrom), iso((await get()).daycareUntil)]).toEqual(["2026-10-01", null]);
    await setDaycareEnrollment(actor, { studentId: s.id, from: "2026-10-01", until: "2026-12-18" });
    expect(iso((await get()).daycareUntil)).toBe("2026-12-18");
    await expect(setDaycareEnrollment(actor, { studentId: s.id, from: "2026-10-01", until: "2026-09-30" })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { until: expect.any(Array) } });
    await expect(setDaycareEnrollment(actor, { studentId: s.id, from: "1 Oct", until: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setDaycareEnrollment(actor, { studentId: s.id, from: "2026-02-31", until: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await setDaycareEnrollment(actor, { studentId: s.id, from: "", until: "2026-12-18" });
    expect(await get()).toEqual({ daycareFrom: null, daycareUntil: null });
    await expect(setDaycareEnrollment(actorOf(await f.user("TEACHER")), { studentId: s.id, from: "2026-10-01" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setDaycareEnrollment(actorOf(await f.user("ACCOUNTANT")), { studentId: s.id, from: "2026-10-01" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
