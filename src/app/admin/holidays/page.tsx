import { requirePage } from "@/lib/page-auth";
import { listSchoolYears } from "@/services/school-years";
import { listHolidays } from "@/services/holidays";
import { addHolidayAction, deleteHolidayAction } from "@/actions/holidays";
import { ActionForm } from "@/components/ActionForm";
import { Table } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { toISODate } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const mn = await getT();
  await requirePage("ADMIN");
  const sp = await searchParams;
  const years = await listSchoolYears();
  const year = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive) ?? years[0];
  if (!year) return <p className="text-ink-muted">{mn.schoolYear.noActive}</p>;
  const holidays = await listHolidays(year.id);
  return (
    <div>
      <PageHeader title={mn.holiday.title} subtitle={year.name}>
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
            <thead><tr><th>{mn.common.date}</th><th>{mn.common.name}</th><th /></tr></thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td className="num">{toISODate(h.date)}</td>
                  <td>{h.name}</td>
                  <td className="text-right">
                    <ActionForm action={deleteHolidayAction} submitLabel={mn.common.delete} className="inline-flex" variant="danger" size="sm">
                      <input type="hidden" name="id" value={h.id} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && <tr><td colSpan={3} className="text-ink-muted">{mn.common.empty}</td></tr>}
            </tbody>
          </Table>
        </div>
        <Card title={mn.holiday.add}>
          <ActionForm action={addHolidayAction} submitLabel={mn.common.add}>
            <input type="hidden" name="schoolYearId" value={year.id} />
            <Field label={mn.common.date}><input name="date" type="date" required className="input" /></Field>
            <Field label={mn.common.name}><input name="name" required className="input" /></Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
