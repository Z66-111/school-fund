"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { addExpense, updateExpense, deleteExpense } from "@/services/expenses";

const page = (classId: string) => `/teacher/class/${classId}`;

export async function addExpenseAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await addExpense(actor, d);
    revalidatePath(page(d.classId), "layout");
  });
}
export async function updateExpenseAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await updateExpense(actor, d.expenseId, d);
    revalidatePath(page(d.classId), "layout");
  });
}
export async function deleteExpenseAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deleteExpense(actor, d.expenseId);
    revalidatePath(page(d.classId), "layout");
  });
}
