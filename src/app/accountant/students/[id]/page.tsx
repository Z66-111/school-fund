import { requirePage } from "@/lib/page-auth";
import { studentBalances, listPayments } from "@/services/payments";
import { registerPaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";
import { StudentBalancesView } from "@/components/StudentBalances";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { toISODate, todayDate } from "@/lib/dates";
import { PAYMENT_KINDS } from "@/lib/roles";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const mn = await getT();
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const { id } = await params;
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: { class: true } });
  const [b, payments] = await Promise.all([studentBalances(actor, id), listPayments(actor, id)]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={student.name} subtitle={`${mn.common.class} ${student.class.name}`} />
      {actor.role === "ACCOUNTANT" && (
        <Card title={mn.payment.register}>
          <ActionForm action={registerPaymentAction} submitLabel={mn.payment.register} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="studentId" value={id} />
            <Field label={mn.payment.kind}>
              <select name="kind" className="input">
                {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{mn.payment[k]}</option>)}
              </select>
            </Field>
            <Field label={mn.common.amount}><input name="amount" type="number" min={1} step={1} required className="input" /></Field>
            <Field label={mn.payment.paidAt}><input name="paidAt" type="date" required defaultValue={toISODate(todayDate())} className="input" /></Field>
            <Field label={mn.common.note}><input name="note" className="input" /></Field>
          </ActionForm>
        </Card>
      )}
      <StudentBalancesView b={b} payments={payments} />
    </div>
  );
}
