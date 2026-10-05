import { Money } from "@/components/Money";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { FundReport } from "@/services/reports";

export function FundReportView({ r, classId }: { r: FundReport; classId: string }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{mn.report.fund} — {r.className}</h2>
        <a href={`/api/reports/fund?classId=${classId}`} className="underline">{mn.common.downloadCsv}</a>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[[mn.report.collected, r.collected], [mn.report.spent, r.spent], [mn.report.balance, r.balance]].map(([l, v]) => (
          <div key={String(l)} className="rounded border bg-white p-3"><div className="text-gray-500">{l}</div><div className="text-lg font-semibold"><Money v={Number(v)} /></div></div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <table className="w-full border bg-white">
          <thead><tr><th className="p-2 text-left" colSpan={3}>{mn.report.contributions} ({mn.class.annualFundAmount}: <Money v={r.annualFundAmount} />)</th></tr>
            <tr><th className="text-left p-2">{mn.common.student}</th><th>{mn.invoice.paid}</th><th>{mn.report.due}</th></tr></thead>
          <tbody>{r.contributions.map((c) => (
            <tr key={c.studentId} className="border-t"><td className="p-2">{c.name}{!c.isActive && ` (${mn.common.inactive})`}</td><td className="text-right"><Money v={c.paid} /></td><td className="text-right"><Money v={c.due} /></td></tr>
          ))}</tbody>
        </table>
        <table className="w-full border bg-white">
          <thead><tr><th className="p-2 text-left" colSpan={4}>{mn.expense.title}</th></tr>
            <tr><th className="text-left p-2">{mn.common.date}</th><th className="text-left">{mn.expense.itemTitle}</th><th>{mn.common.amount}</th><th className="text-left">{mn.common.note}</th></tr></thead>
          <tbody>{r.expenses.map((e) => (
            <tr key={e.id} className="border-t"><td className="p-2">{toISODate(e.date)}</td><td>{e.title}</td><td className="text-right"><Money v={e.amount} /></td><td>{e.note}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
