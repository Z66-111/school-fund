import { requirePage } from "@/lib/page-auth";
import { listAllPayments } from "@/services/payments";
import { deletePaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { PaymentKind } from "@/lib/roles";

export default async function Page() {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const payments = await listAllPayments(actor);
  return (
    <div>
      <PageHeader title={mn.nav.payments} />
      <Table>
        <thead><tr><th>{mn.payment.paidAt}</th><th>{mn.common.class}</th><th>{mn.common.student}</th><th>{mn.payment.kind}</th><th className="num">{mn.common.amount}</th><th>{mn.common.note}</th><th>{mn.payment.registeredBy}</th><th /></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className={p.deletedAt ? "muted" : ""}>
              <td className="num">{toISODate(p.paidAt)}</td>
              <td>{p.student.class.name}</td>
              <td className="font-medium">{p.student.name}</td>
              <td>{mn.payment[p.kind as PaymentKind]}</td>
              <td className="num"><Money v={p.amount} className={p.deletedAt ? "line-through" : ""} /></td>
              <td className="text-ink-muted">{p.note}</td>
              <td className="text-ink-muted">{p.registeredBy.name}</td>
              <td className="text-right">
                {p.deletedAt ? (
                  <span className="inline-flex items-center gap-2"><Badge tone="bad">{mn.payment.deleted}</Badge><span className="text-xs">{p.deleteReason}</span></span>
                ) : p.registeredById === actor.userId ? (
                  <ActionForm action={deletePaymentAction} submitLabel={mn.common.delete} className="inline-flex items-center gap-2" variant="danger" size="sm">
                    <input type="hidden" name="paymentId" value={p.id} />
                    <input name="reason" required placeholder={mn.common.reason} className="input w-36" />
                  </ActionForm>
                ) : null}
              </td>
            </tr>
          ))}
          {payments.length === 0 && <tr><td colSpan={8} className="text-ink-muted">{mn.common.empty}</td></tr>}
        </tbody>
      </Table>
    </div>
  );
}
