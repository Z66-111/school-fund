import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { StatTile } from "@/components/ui/StatTile";
import { Badge } from "@/components/ui/Badge";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { StudentBalances } from "@/services/payments";
import type { PaymentKind } from "@/lib/roles";

type PaymentRow = { id: string; kind: string; amount: number; paidAt: Date; note: string; registeredBy: { name: string } };

export function StudentBalancesView({ b, payments, tiles = true }: { b: StudentBalances; payments: PaymentRow[]; tiles?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      {tiles && <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label={mn.payment.foodDue} value={b.foodOutstanding} tone={b.foodOutstanding > 0 ? "due" : "good"} />
        <StatTile label={mn.payment.daycareDue} value={b.daycareOutstanding} tone={b.daycareOutstanding > 0 ? "due" : "good"} />
        <StatTile label={mn.payment.fundDue} value={b.fundDue} tone={b.fundDue > 0 ? "due" : "good"} />
        <StatTile label={`${mn.payment.ANNUAL_FUND}, ${mn.invoice.paid.toLowerCase()}`} value={b.fundPaid} tone="neutral" />
        {b.foodCredit > 0
          ? <StatTile label={mn.invoice.credit} value={b.foodCredit} tone="brand" />
          : <StatTile label={mn.class.annualFundAmount} value={b.annualFundAmount} tone="neutral" />}
      </div>}
      <div className="grid gap-6 xl:grid-cols-2">
        <InvoiceTable title={mn.invoice.title} invoices={b.invoices} invoiced={b.foodInvoiced} paid={b.foodPaid} outstanding={b.foodOutstanding} />
        <InvoiceTable title={mn.invoice.daycareTitle} invoices={b.daycareInvoices} invoiced={b.daycareInvoiced} paid={b.daycarePaid} outstanding={b.daycareOutstanding} />
        <section>
          <h2 className="mb-2">{mn.payment.history}</h2>
          <Table>
            <thead><tr><th>{mn.payment.paidAt}</th><th>{mn.payment.kind}</th><th className="num">{mn.common.amount}</th><th>{mn.common.note}</th><th>{mn.payment.registeredBy}</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="num">{toISODate(p.paidAt)}</td>
                  <td>{mn.payment[p.kind as PaymentKind]}</td>
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

type InvoiceRow = { id: string; year: number; month: number; daysPresent: number; amount: number; paid: number; outstanding: number; provisional: boolean };

function InvoiceTable({ title, invoices, invoiced, paid, outstanding }: { title: string; invoices: InvoiceRow[]; invoiced: number; paid: number; outstanding: number }) {
  return (
    <section>
      <h2 className="mb-2">{title}</h2>
      <Table>
        <thead><tr><th>{mn.common.month}</th><th className="ctr">{mn.attendance.daysPresent}</th><th className="num">{mn.invoice.amount}</th><th className="num">{mn.invoice.paid}</th><th className="num">{mn.invoice.outstanding}</th></tr></thead>
        <tbody>
          {invoices.map((i) => (
            <tr key={i.id} className={i.outstanding > 0 ? "due" : ""}>
              <td className="font-medium">{i.year} {mn.months[i.month - 1]}{i.provisional && <> <Badge tone="warn">{mn.invoice.provisional}</Badge></>}</td>
              <td className="ctr num">{i.daysPresent}</td>
              <td className="num"><Money v={i.amount} /></td>
              <td className="num"><Money v={i.paid} /></td>
              <td className="num"><Money v={i.outstanding} /></td>
            </tr>
          ))}
          {invoices.length === 0 && <tr><td colSpan={5} className="text-ink-muted">{mn.common.empty}</td></tr>}
        </tbody>
        <tfoot><tr><td colSpan={2}>{mn.common.total}</td><td className="num"><Money v={invoiced} /></td><td className="num"><Money v={paid} /></td><td className="num"><Money v={outstanding} /></td></tr></tfoot>
      </Table>
    </section>
  );
}
