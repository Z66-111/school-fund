import { requirePage } from "@/lib/page-auth";
import Link from "next/link";
import { listSchoolYears } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { createClassAction } from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await requirePage("ADMIN");
  const sp = await searchParams;
  const years = await listSchoolYears();
  const year = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive) ?? years[0];
  if (!year) return <p className="text-ink-muted">{mn.schoolYear.noActive}</p>;
  const classes = await listClasses(year.id);
  return (
    <div>
      <PageHeader title={mn.nav.classes} subtitle={year.name}>
        <form className="flex items-center gap-2">
          <select name="year" defaultValue={year.id} className="input w-auto">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <button className={buttonClass("secondary", "sm")}>{mn.common.apply}</button>
        </form>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <thead><tr><th>{mn.common.class}</th><th>{mn.common.teacher}</th><th className="num">{mn.class.dailyFoodRate}</th><th className="num">{mn.class.annualFundAmount}</th><th className="ctr">{mn.nav.students}</th></tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/classes/${c.id}`} className="link font-medium">{c.name}</Link></td>
                  <td className={c.teacher ? "" : "text-ink-muted"}>{c.teacher?.name ?? mn.class.noTeacher}</td>
                  <td className="num"><Money v={c.dailyFoodRate} /></td>
                  <td className="num"><Money v={c.annualFundAmount} /></td>
                  <td className="ctr num">{c._count.students}</td>
                </tr>
              ))}
              {classes.length === 0 && <tr><td colSpan={5} className="text-ink-muted">{mn.common.empty}</td></tr>}
            </tbody>
          </Table>
        </div>
        <Card title={mn.class.create}>
          <ActionForm action={createClassAction} submitLabel={mn.common.add}>
            <input type="hidden" name="schoolYearId" value={year.id} />
            <Field label={mn.common.name}><input name="name" required className="input" placeholder="1А" /></Field>
            <Field label={mn.class.dailyFoodRate}><input name="dailyFoodRate" type="number" min={1} step={1} required className="input" /></Field>
            <Field label={mn.class.annualFundAmount}><input name="annualFundAmount" type="number" min={1} step={1} required className="input" /></Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
