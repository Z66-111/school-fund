"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { addStudent, setStudentActive, deleteStudent, linkParent, createParentForStudent, setDaycareEnrollment } from "@/services/students";
import { mn } from "@/lib/i18n/mn";

const page = (classId: string) => `/teacher/class/${classId}/students`;

export async function addStudentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await addStudent(actor, d);
    revalidatePath(page(d.classId));
  });
}
export async function setStudentActiveAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await setStudentActive(actor, d.studentId, d.isActive === "true");
    revalidatePath(page(d.classId));
  });
}
export async function deleteStudentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deleteStudent(actor, d.studentId);
    revalidatePath(page(d.classId));
  });
}
export async function linkParentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await linkParent(actor, d);
    revalidatePath(page(d.classId));
  });
}
export async function createParentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createParentForStudent(actor, d);
    revalidatePath(page(d.classId));
    return `${mn.student.parentCreated} ${d.password}`;
  });
}

export async function setDaycareEnrollmentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await setDaycareEnrollment(actor, d);
    revalidatePath(`/teacher/class/${d.classId}`, "layout");
    return mn.student.daycareSaved;
  });
}
