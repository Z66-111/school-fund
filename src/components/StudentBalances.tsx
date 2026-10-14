import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { StatTile } from "@/components/ui/StatTile";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { StudentBalances } from "@/services/payments";

type PaymentRow = { id: string; kind: string; amount: number; paidAt: Date; note: string; registeredBy: { name: string } };

export function StudentBalancesView({ b, payments, tiles = true }: { b: StudentBalances; payments: PaymentRow[]; tiles?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {tiles && <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatTile label={mn.payment.foodDue} value={b.foodOutstanding} tone={b.foodOutstanding > 0 ? "due" : "good"} />
        <StatTile label={mn.payment.fundDue} value={b.fundDue} tone={b.fundDue > 0 ? "due" : "good"} />
        <StatTile label={`${mn.payment.ANNUAL_FUND}, ${mn.invoice.paid.toLowerCase()}`} value={b.fundPaid} tone="neutral" />
        {b.foodCredit > 0
          ? <StatTile label={mn.invoice.credit} value={b.foodCredit} tone="teal" />
          : <StatTile label={mn.class.annualFundAmount} value={b.annualFundAmount} tone="neutral" />}
      </div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-2">{mn.invoice.title}</h2>
          <Table>
            <thead><tr><th>{mn.common.month}</th><th className="ctr">{mn.attendance.daysPresent}</th><th className="num">{mn.invoice.amount}</th><th className="num">{mn.invoice.paid}</th><th className="num">{mn.invoice.outstanding}</th></tr></thead>
            <tbody>
              {b.invoices.map((i) => (
                <tr key={i.id} className={i.outstanding > 0 ? "due" : ""}>
                  <td className="font-medium">{i.year} {mn.months[i.month - 1]}</td>
                  <td className="ctr num">{i.daysPresent}</td>
                  <td className="num"><Money v={i.amount} /></td>
                  <td className="num"><Money v={i.paid} /></td>
                  <td className="num"><Money v={i.outstanding} /></td>
                </tr>
              ))}
              {b.invoices.length === 0 && <tr><td colSpan={5} className="text-ink-muted">{mn.common.empty}</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={2}>{mn.common.total}</td><td className="num"><Money v={b.foodInvoiced} /></td><td className="num"><Money v={b.foodPaid} /></td><td className="num"><Money v={b.foodOutstanding} /></td></tr></tfoot>
          </Table>
        </section>
        <section>
          <h2 className="mb-2">{mn.payment.history}</h2>
          <Table>
            <thead><tr><th>{mn.payment.paidAt}</th><th>{mn.payment.kind}</th><th className="num">{mn.common.amount}</th><th>{mn.common.note}</th><th>{mn.payment.registeredBy}</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{toISODate(p.paidAt)}</td>
                  <td>{mn.payment[p.kind as "FOOD" | "ANNUAL_FUND"]}</td>
                  <td className="num"><Money v={p.amount} /></td>
                  <td className="text-ink-muted">{p.note}</td>
                  <td className="text-ink-muted">{p.registeredBy.name}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={5} className="text-ink-muted">{mn.common.empty}</td></tr>}
            </tbody>
          </Table>
        </section>
      </div>
    </div>
  );
}
