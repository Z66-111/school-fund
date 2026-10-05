import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";
import type { FoodReport } from "@/services/reports";

export function FoodReportView({ r, classId }: { r: FoodReport; classId: string }) {
  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center gap-4">
        <h2 className="text-lg font-semibold">{mn.report.food} — {r.className} · {r.year} {mn.months[r.month - 1]}</h2>
        {!r.closed && <span className="rounded bg-yellow-100 px-2">{mn.errors.monthNotClosed}</span>}
        <a href={`/api/reports/food?classId=${classId}&year=${r.year}&month=${r.month}`} className="underline">{mn.common.downloadCsv}</a>
      </div>
      <table className="w-full border bg-white">
        <thead><tr><th className="p-2 text-left">{mn.common.student}</th><th>{mn.attendance.daysPresent}</th><th>{mn.invoice.amount}</th><th>{mn.invoice.paid}</th><th>{mn.invoice.outstanding}</th></tr></thead>
        <tbody>{r.rows.map((x) => (
          <tr key={x.studentId} className="border-t"><td className="p-2">{x.name}</td><td className="text-center">{x.daysPresent}</td><td className="text-right"><Money v={x.amount} /></td><td className="text-right"><Money v={x.paid} /></td><td className="text-right"><Money v={x.outstanding} /></td></tr>
        ))}</tbody>
        <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>{mn.common.total}</td><td className="text-right"><Money v={r.totals.amount} /></td><td className="text-right"><Money v={r.totals.paid} /></td><td className="text-right"><Money v={r.totals.outstanding} /></td></tr></tfoot>
      </table>
    </div>
  );
}
