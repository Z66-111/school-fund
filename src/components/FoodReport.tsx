import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { getT } from "@/lib/i18n/server";
import type { FoodReport } from "@/services/reports";

export async function FoodReportView({ r, classId }: { r: FoodReport; classId: string }) {
  const mn = await getT();
  const daycare = r.kind === "DAYCARE";
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2>{r.kind === "DAYCARE" ? mn.report.daycare : mn.report.food} <span className="font-normal text-ink-muted">{r.className}, {r.year} {mn.months[r.month - 1]}</span></h2>
          {!r.closed && <Badge tone="warn">{daycare ? mn.invoice.provisional : mn.invoice.runningNote}</Badge>}
        </div>
        <a href={`/api/reports/food?classId=${classId}&year=${r.year}&month=${r.month}&kind=${r.kind}`} className={buttonClass("secondary", "sm")}>{mn.common.downloadCsv}</a>
      </div>
      <Table>
        <thead><tr><th>{mn.common.student}</th><th className="ctr">{daycare ? mn.invoice.daycareDays : mn.attendance.daysPresent}</th>{daycare && <th className="ctr">{mn.invoice.deductedDays}</th>}<th className="num">{mn.invoice.amount}</th><th className="num">{mn.invoice.paid}</th><th className="num">{mn.invoice.outstanding}</th></tr></thead>
        <tbody>
          {r.rows.map((x) => (
            <tr key={x.studentId} className={x.outstanding > 0 ? "due" : ""}>
              <td>{x.name}</td>
              <td className="ctr num">{x.daysPresent}</td>
              {daycare && <td className="ctr num">{x.deductedDays ? `−${x.deductedDays}` : ""}</td>}
              <td className="num"><Money v={x.amount} /></td>
              <td className="num"><Money v={x.paid} /></td>
              <td className="num"><Money v={x.outstanding} /></td>
            </tr>
          ))}
          {r.rows.length === 0 && <tr><td colSpan={daycare ? 6 : 5} className="text-ink-muted">{mn.common.empty}</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={daycare ? 3 : 2}>{mn.common.total}</td><td className="num"><Money v={r.totals.amount} /></td><td className="num"><Money v={r.totals.paid} /></td><td className="num"><Money v={r.totals.outstanding} /></td></tr></tfoot>
      </Table>
    </section>
  );
}
