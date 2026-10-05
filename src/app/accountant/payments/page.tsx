import { requirePage } from "@/lib/page-auth";
import { listAllPayments } from "@/services/payments";
import { deletePaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const payments = await listAllPayments(actor);
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{mn.nav.payments}</h1>
      <table className="w-full border bg-white text-sm">
        <thead><tr><th className="p-2 text-left">{mn.payment.paidAt}</th><th>{mn.common.class}</th><th>{mn.common.student}</th><th>{mn.payment.kind}</th><th>{mn.common.amount}</th><th>{mn.common.note}</th><th>{mn.payment.registeredBy}</th><th>{mn.common.actions}</th></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className={`border-t ${p.deletedAt ? "text-gray-400 line-through" : ""}`}>
              <td className="p-2">{toISODate(p.paidAt)}</td>
              <td>{p.student.class.name}</td>
              <td>{p.student.name}</td>
              <td>{mn.payment[p.kind as "FOOD" | "ANNUAL_FUND"]}</td>
              <td className="text-right"><Money v={p.amount} /></td>
              <td>{p.note}</td>
              <td>{p.registeredBy.name}</td>
              <td className="p-1">
                {p.deletedAt ? (
                  <span className="no-underline">{mn.payment.deleted}: {p.deleteReason}</span>
                ) : p.registeredById === actor.userId ? (
                  <ActionForm action={deletePaymentAction} submitLabel={mn.common.delete} className="flex gap-1">
                    <input type="hidden" name="paymentId" value={p.id} />
                    <input name="reason" required placeholder={mn.common.reason} className="w-32 rounded border p-1" />
                  </ActionForm>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
