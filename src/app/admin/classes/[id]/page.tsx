import Link from "next/link";
import { getClass } from "@/services/classes";
import { listUsers } from "@/services/users";
import { updateClassRatesAction, assignTeacherAction } from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getClass(id);
  const teachers = await listUsers("TEACHER");
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded border bg-white p-4">
        <h1 className="mb-2 text-xl font-semibold">{c.name} — {c.schoolYear.name}</h1>
        <Link href={`/admin/classes/${c.id}/months`} className="mb-2 inline-block text-sm underline">{mn.attendance.closed}</Link>
        <ActionForm action={updateClassRatesAction} submitLabel={mn.common.save}>
          <input type="hidden" name="classId" value={c.id} />
          <label className="text-sm">{mn.class.dailyFoodRate}<input name="dailyFoodRate" type="number" min={1} step={1} defaultValue={c.dailyFoodRate} className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.class.annualFundAmount}<input name="annualFundAmount" type="number" min={1} step={1} defaultValue={c.annualFundAmount} className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.class.assignTeacher}</h2>
        <ActionForm action={assignTeacherAction} submitLabel={mn.common.save}>
          <input type="hidden" name="classId" value={c.id} />
          <select name="teacherId" defaultValue={c.teacherId ?? ""} className="rounded border p-1">
            <option value="">{mn.class.noTeacher}</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
          </select>
        </ActionForm>
      </section>
    </div>
  );
}
