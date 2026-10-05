"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createUser, resetPassword } from "@/services/users";

export async function createUserAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createUser(actor, d);
    revalidatePath("/admin/users");
  });
}
export async function resetPasswordAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await resetPassword(actor, d.userId, d.password);
    revalidatePath("/admin/users");
  });
}
