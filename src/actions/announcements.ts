"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { saveAnnouncement } from "@/services/announcements";
import { mn } from "@/lib/i18n/mn";

export async function saveAnnouncementAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    const showing = await saveAnnouncement(actor, d.classId, d.text);
    revalidatePath(`/teacher/class/${d.classId}/announcement`);
    revalidatePath("/parent", "layout");
    return showing ? mn.announcement.saved : mn.announcement.cleared;
  });
}
