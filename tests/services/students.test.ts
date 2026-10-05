import { describe, it, expect } from "vitest";
import { addStudent, setStudentActive, deleteStudent, linkParent, createParentForStudent, listStudents, listChildren } from "@/services/students";
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
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    expect(s.isActive).toBe(true);
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
});
