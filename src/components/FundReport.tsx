import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { StatTile } from "@/components/ui/StatTile";
import { buttonClass } from "@/components/ui/Button";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { FundReport } from "@/services/reports";

export function FundReportView({ r, classId }: { r: FundReport; classId: string }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2>{mn.report.fund} <span className="font-normal text-ink-muted">{r.className}</span></h2>
        <a href={`/api/reports/fund?classId=${classId}`} className={buttonClass("secondary", "sm")}>{mn.common.downloadCsv}</a>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <StatTile label={mn.report.collected} value={r.collected} tone="teal" />
        <StatTile label={mn.report.spent} value={r.spent} tone="neutral" />
        <StatTile label={mn.report.balance} value={r.balance} tone={r.balance < 0 ? "due" : "good"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <h3 className="font-semibold">{mn.report.contributions}</h3>
            <span className="text-ink-muted">{mn.class.annualFundAmount}: <Money v={r.annualFundAmount} /></span>
          </div>
          <Table>
            <thead><tr><th>{mn.common.student}</th><th className="num">{mn.invoice.paid}</th><th className="num">{mn.report.due}</th></tr></thead>
            <tbody>
              {r.contributions.map((c) => (
                <tr key={c.studentId} className={c.isActive ? (c.due > 0 ? "due" : "") : "muted"}>
                  <td>{c.name}{!c.isActive && <span className="text-ink-muted"> ({mn.common.inactive})</span>}</td>
                  <td className="num"><Money v={c.paid} /></td>
                  <td className="num"><Money v={c.due} /></td>
                </tr>
              ))}
              {r.contributions.length === 0 && <tr><td colSpan={3} className="text-ink-muted">{mn.common.empty}</td></tr>}
            </tbody>
          </Table>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{mn.expense.title}</h3>
          <Table>
            <thead><tr><th>{mn.common.date}</th><th>{mn.expense.itemTitle}</th><th className="num">{mn.common.amount}</th><th>{mn.common.note}</th></tr></thead>
            <tbody>
              {r.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="num">{toISODate(e.date)}</td>
                  <td>{e.title}</td>
                  <td className="num"><Money v={e.amount} /></td>
                  <td className="text-ink-muted">{e.note}</td>
                </tr>
              ))}
              {r.expenses.length === 0 && <tr><td colSpan={4} className="text-ink-muted">{mn.common.empty}</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={2}>{mn.common.total}</td><td className="num"><Money v={r.spent} /></td><td /></tr></tfoot>
          </Table>
        </div>
      </div>
    </section>
  );
}
