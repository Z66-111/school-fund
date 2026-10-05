import { requirePage } from "@/lib/page-auth";
import { studentBalances, listPayments } from "@/services/payments";
import { registerPaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";
import { StudentBalancesView } from "@/components/StudentBalances";
import { prisma } from "@/lib/db";
import { toISODate, todayDate } from "@/lib/dates";
import { PAYMENT_KINDS } from "@/lib/roles";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const { id } = await params;
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: { class: true } });
  const [b, payments] = await Promise.all([studentBalances(actor, id), listPayments(actor, id)]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{student.class.name} · {student.name}</h1>
      <StudentBalancesView b={b} payments={payments} />
      {actor.role === "ACCOUNTANT" && (
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-semibold">{mn.payment.register}</h2>
          <ActionForm action={registerPaymentAction} submitLabel={mn.common.save} className="grid gap-2 md:grid-cols-5">
            <input type="hidden" name="studentId" value={id} />
            <select name="kind" className="rounded border p-1">
              {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{mn.payment[k]}</option>)}
            </select>
            <input name="amount" type="number" min={1} step={1} required placeholder={mn.common.amount} className="rounded border p-1" />
            <input name="paidAt" type="date" required defaultValue={toISODate(todayDate())} className="rounded border p-1" />
            <input name="note" placeholder={mn.common.note} className="rounded border p-1" />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
