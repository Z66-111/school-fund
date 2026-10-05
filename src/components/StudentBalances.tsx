import { Money } from "@/components/Money";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { StudentBalances } from "@/services/payments";

type PaymentRow = { id: string; kind: string; amount: number; paidAt: Date; note: string; registeredBy: { name: string } };

export function StudentBalancesView({ b, payments }: { b: StudentBalances; payments: PaymentRow[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{mn.invoice.title}</h2>
        <table className="w-full">
          <thead><tr><th className="text-left">{mn.common.month}</th><th>{mn.attendance.daysPresent}</th><th>{mn.invoice.amount}</th><th>{mn.invoice.paid}</th><th>{mn.invoice.outstanding}</th></tr></thead>
          <tbody>
            {b.invoices.map((i) => (
              <tr key={i.id} className="border-t">
                <td>{i.year} {mn.months[i.month - 1]}</td>
                <td className="text-center">{i.daysPresent}</td>
                <td className="text-right"><Money v={i.amount} /></td>
                <td className="text-right"><Money v={i.paid} /></td>
                <td className="text-right"><Money v={i.outstanding} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2">{mn.payment.foodDue}: <b><Money v={b.foodOutstanding} /></b>{b.foodCredit > 0 && <> · {mn.invoice.credit}: <Money v={b.foodCredit} /></>}</p>
        <p>{mn.payment.ANNUAL_FUND}: {mn.invoice.paid} <Money v={b.fundPaid} /> / <Money v={b.annualFundAmount} /> · {mn.payment.fundDue}: <b><Money v={b.fundDue} /></b></p>
      </section>
      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{mn.payment.history}</h2>
        <table className="w-full">
          <thead><tr><th className="text-left">{mn.payment.paidAt}</th><th>{mn.payment.kind}</th><th>{mn.common.amount}</th><th>{mn.common.note}</th><th>{mn.payment.registeredBy}</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td>{toISODate(p.paidAt)}</td>
                <td className="text-center">{mn.payment[p.kind as "FOOD" | "ANNUAL_FUND"]}</td>
                <td className="text-right"><Money v={p.amount} /></td>
                <td>{p.note}</td>
                <td>{p.registeredBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
