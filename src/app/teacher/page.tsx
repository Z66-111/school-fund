import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { getTeacherClass } from "@/services/classes";
import { mn } from "@/lib/i18n/mn";

export default async function TeacherHome() {
  const actor = await requirePage("TEACHER", "ADMIN");
  if (actor.role === "ADMIN") redirect("/admin");
  const c = await getTeacherClass(actor.userId);
  if (!c) return <p>{mn.class.noClass}</p>;
  redirect(`/teacher/class/${c.id}/attendance`);
}
