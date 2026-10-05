import { requirePage } from "@/lib/page-auth";
import { listSchoolYears } from "@/services/school-years";
import { createSchoolYearAction, activateSchoolYearAction } from "@/actions/school-years";
import { ActionForm } from "@/components/ActionForm";
import { Table } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  await requirePage("ADMIN");
  const years = await listSchoolYears();
  return (
    <div>
      <PageHeader title={mn.schoolYear.title} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <thead><tr><th>{mn.common.name}</th><th>{mn.schoolYear.startDate}</th><th>{mn.schoolYear.endDate}</th><th>{mn.common.status}</th><th /></tr></thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id}>
                  <td className="font-medium">{y.name}</td>
                  <td className="num">{toISODate(y.startDate)}</td>
                  <td className="num">{toISODate(y.endDate)}</td>
                  <td>{y.isActive ? <Badge tone="good">{mn.common.active}</Badge> : <Badge>{mn.common.inactive}</Badge>}</td>
                  <td className="text-right">
                    {!y.isActive && (
                      <ActionForm action={activateSchoolYearAction} submitLabel={mn.common.activate} className="inline-flex" variant="secondary" size="sm">
                        <input type="hidden" name="id" value={y.id} />
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
              {years.length === 0 && <tr><td colSpan={5} className="text-ink-muted">{mn.common.empty}</td></tr>}
            </tbody>
          </Table>
        </div>
        <Card title={mn.schoolYear.create}>
          <ActionForm action={createSchoolYearAction} submitLabel={mn.common.add}>
            <Field label={mn.common.name}><input name="name" required className="input" placeholder="2026-2027" /></Field>
            <Field label={mn.schoolYear.startDate}><input name="startDate" type="date" required className="input" /></Field>
            <Field label={mn.schoolYear.endDate}><input name="endDate" type="date" required className="input" /></Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
