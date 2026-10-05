"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { saveSchedule } from "@/services/schedule";
import { mn } from "@/lib/i18n/mn";

export async function saveScheduleAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await saveSchedule(actor, d.classId, d);
    revalidatePath(`/teacher/class/${d.classId}/schedule`);
    return mn.schedule.saved;
  });
}
