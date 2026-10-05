import { requirePage } from "@/lib/page-auth";
import { listMonthCloses } from "@/services/month-close";
import { reopenMonthAction } from "@/actions/month-close";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("ADMIN");
  const { id } = await params;
  const closes = await listMonthCloses(id);
  return (
    <table className="w-full border bg-white text-sm">
      <thead><tr><th className="p-2 text-left">{mn.common.month}</th><th>{mn.attendance.closedAt}</th><th /></tr></thead>
      <tbody>
        {closes.map((m) => (
          <tr key={m.id} className="border-t">
            <td className="p-2">{m.year} {mn.months[m.month - 1]}</td>
            <td className="text-center">{m.closedAt.toISOString().slice(0, 10)} · {m.closedBy.name}</td>
            <td className="p-1">
              <ActionForm action={reopenMonthAction} submitLabel={mn.attendance.reopenMonth} className="inline">
                <input type="hidden" name="classId" value={id} />
                <input type="hidden" name="year" value={m.year} />
                <input type="hidden" name="month" value={m.month} />
              </ActionForm>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
