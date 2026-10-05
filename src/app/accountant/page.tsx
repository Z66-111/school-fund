import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { outstandingTable } from "@/services/payments";
import { getActiveSchoolYear } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { buttonClass } from "@/components/ui/Button";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const { classId } = await searchParams;
  const year = await getActiveSchoolYear();
  const classes = await listClasses(year.id);
  const rows = await outstandingTable(actor, classId || undefined);
  const food = rows.reduce((a, r) => a + r.foodDue, 0);
  const fund = rows.reduce((a, r) => a + r.fundDue, 0);
  return (
    <div>
      <PageHeader title={mn.nav.outstanding} subtitle={year.name}>
        <form className="flex items-center gap-2">
          <select name="classId" defaultValue={classId ?? ""} className="input w-auto">
            <option value="">{mn.common.filterAll}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className={buttonClass("secondary", "sm")}>{mn.common.apply}</button>
        </form>
      </PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
        <StatTile label={mn.common.student} value={String(rows.length)} money={false} tone="neutral" />
        <StatTile label={mn.payment.foodDue} value={food} tone={food > 0 ? "due" : "good"} />
        <StatTile label={mn.payment.fundDue} value={fund} tone={fund > 0 ? "due" : "good"} />
      </div>
      <Table>
        <thead><tr><th>{mn.common.class}</th><th>{mn.common.student}</th><th className="num">{mn.payment.foodDue}</th><th className="num">{mn.payment.fundDue}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className={r.foodDue + r.fundDue > 0 ? "due" : ""}>
              <td>{r.className}{!r.isActiveYear && <span className="text-ink-muted"> ({r.schoolYearName})</span>}</td>
              <td><Link href={`/accountant/students/${r.studentId}`} className="link font-medium">{r.studentName}</Link>{!r.isActive && <span className="text-ink-muted"> ({mn.common.inactive})</span>}</td>
              <td className="num"><Money v={r.foodDue} /></td>
              <td className="num"><Money v={r.fundDue} /></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="text-ink-muted">{mn.common.empty}</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={2}>{mn.common.total}</td><td className="num"><Money v={food} /></td><td className="num"><Money v={fund} /></td></tr></tfoot>
      </Table>
    </div>
  );
}
