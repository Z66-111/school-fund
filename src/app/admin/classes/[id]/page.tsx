import { requirePage } from "@/lib/page-auth";
import Link from "next/link";
import { getClass } from "@/services/classes";
import { listUsers } from "@/services/users";
import { updateClassRatesAction, assignTeacherAction } from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("ADMIN");
  const { id } = await params;
  const c = await getClass(id);
  const teachers = await listUsers("TEACHER");
  return (
    <div>
      <PageHeader title={`${mn.common.class} ${c.name}`} subtitle={c.schoolYear.name}>
        <Link href={`/teacher/class/${c.id}/attendance`} className={buttonClass("secondary", "sm")}>{mn.nav.attendance}</Link>
        <Link href={`/admin/classes/${c.id}/months`} className={buttonClass("secondary", "sm")}>{mn.attendance.closed}</Link>
        <Link href={`/admin/classes/${c.id}/report`} className={buttonClass("secondary", "sm")}>{mn.nav.report}</Link>
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title={mn.class.title}>
          <ActionForm action={updateClassRatesAction} submitLabel={mn.common.save}>
            <input type="hidden" name="classId" value={c.id} />
            <Field label={mn.class.dailyFoodRate}><input name="dailyFoodRate" type="number" min={1} step={1} defaultValue={c.dailyFoodRate} className="input" /></Field>
            <Field label={mn.class.dailyDaycareRate}><input name="dailyDaycareRate" type="number" min={1} step={1} defaultValue={c.dailyDaycareRate} className="input" /></Field>
            <Field label={mn.class.annualFundAmount}><input name="annualFundAmount" type="number" min={1} step={1} defaultValue={c.annualFundAmount} className="input" /></Field>
          </ActionForm>
        </Card>
        <Card title={mn.class.assignTeacher}>
          <ActionForm action={assignTeacherAction} submitLabel={mn.common.save}>
            <input type="hidden" name="classId" value={c.id} />
            <Field label={mn.common.teacher}>
              <select name="teacherId" defaultValue={c.teacherId ?? ""} className="input">
                <option value="">{mn.class.noTeacher}</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
              </select>
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
