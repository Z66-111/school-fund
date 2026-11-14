import { requirePage } from "@/lib/page-auth";
import { listMonthCloses } from "@/services/month-close";
import { getClass } from "@/services/classes";
import { reopenMonthAction } from "@/actions/month-close";
import { ActionForm } from "@/components/ActionForm";
import { Table } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { toISODate } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const mn = await getT();
  await requirePage("ADMIN");
  const { id } = await params;
  const [closes, c] = await Promise.all([listMonthCloses(id), getClass(id)]);
  return (
    <div>
      <PageHeader title={mn.attendance.closed} subtitle={`${mn.common.class} ${c.name}`} />
      <Table className="max-w-2xl">
        <thead><tr><th>{mn.common.month}</th><th>{mn.attendance.closedAt}</th><th>{mn.common.teacher}</th><th /></tr></thead>
        <tbody>
          {closes.map((m) => (
            <tr key={m.id}>
              <td className="font-medium">{m.year} {mn.months[m.month - 1]}</td>
              <td className="num">{toISODate(m.closedAt)}</td>
              <td>{m.closedBy.name}</td>
              <td className="text-right">
                <ActionForm action={reopenMonthAction} submitLabel={mn.attendance.reopenMonth} className="inline-flex" variant="danger" size="sm">
                  <input type="hidden" name="classId" value={id} />
                  <input type="hidden" name="year" value={m.year} />
                  <input type="hidden" name="month" value={m.month} />
                </ActionForm>
              </td>
            </tr>
          ))}
          {closes.length === 0 && <tr><td colSpan={4} className="text-ink-muted">{mn.common.empty}</td></tr>}
        </tbody>
      </Table>
    </div>
  );
}
