import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { outstandingTable } from "@/services/payments";
import { getActiveSchoolYear } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const { classId } = await searchParams;
  const year = await getActiveSchoolYear();
  const classes = await listClasses(year.id);
  const rows = await outstandingTable(actor, classId || undefined);
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{mn.nav.outstanding} — {year.name}</h1>
      <form className="mb-2 text-sm">
        <select name="classId" defaultValue={classId ?? ""} className="rounded border p-1">
          <option value="">{mn.common.filterAll}</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>{" "}<button className="underline">{mn.common.apply}</button>
      </form>
      <table className="w-full border bg-white text-sm">
        <thead><tr><th className="p-2 text-left">{mn.common.class}</th><th className="text-left">{mn.common.student}</th><th>{mn.payment.foodDue}</th><th>{mn.payment.fundDue}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className="border-t">
              <td className="p-2">{r.className}</td>
              <td><Link href={`/accountant/students/${r.studentId}`} className="underline">{r.studentName}</Link>{!r.isActive && ` (${mn.common.inactive})`}</td>
              <td className="text-right"><Money v={r.foodDue} /></td>
              <td className="text-right"><Money v={r.fundDue} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>{mn.common.total}</td>
          <td className="text-right"><Money v={rows.reduce((a, r) => a + r.foodDue, 0)} /></td>
          <td className="text-right"><Money v={rows.reduce((a, r) => a + r.fundDue, 0)} /></td></tr></tfoot>
      </table>
    </div>
  );
}
