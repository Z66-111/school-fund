import { requireClassPage } from "@/lib/page-auth";
import { listExpenses } from "@/services/expenses";
import { addExpenseAction, updateExpenseAction, deleteExpenseAction } from "@/actions/expenses";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { toISODate, todayDate } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const mn = await getT();
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const isTeacher = actor.role === "TEACHER";
  const expenses = await listExpenses(actor, id);
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className={isTeacher ? "lg:col-span-2" : "lg:col-span-3"}>
        <Table>
          <thead><tr><th>{mn.common.date}</th><th>{mn.expense.itemTitle}</th><th className="num">{mn.common.amount}</th><th>{mn.common.note}</th>{isTeacher && <th />}</tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="num">{toISODate(e.date)}</td>
                <td className="font-medium">{e.title}</td>
                <td className="num"><Money v={e.amount} /></td>
                <td className="text-ink-muted">{e.note}</td>
                {isTeacher && (
                  <td className="text-right">
                    <details className="text-left">
                      <summary className="text-xs">{mn.common.edit}</summary>
                      <ActionForm action={updateExpenseAction} submitLabel={mn.common.save} className="mt-2 flex flex-col gap-2" size="sm">
                        <input type="hidden" name="classId" value={id} />
                        <input type="hidden" name="expenseId" value={e.id} />
                        <input name="date" type="date" defaultValue={toISODate(e.date)} className="input" />
                        <input name="title" defaultValue={e.title} className="input" />
                        <input name="amount" type="number" min={1} step={1} defaultValue={e.amount} className="input" />
                        <input name="note" defaultValue={e.note} className="input" />
                      </ActionForm>
                    </details>
                    <ActionForm action={deleteExpenseAction} submitLabel={mn.common.delete} className="mt-1 inline-flex" variant="danger" size="sm">
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="expenseId" value={e.id} />
                    </ActionForm>
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={isTeacher ? 5 : 4} className="text-ink-muted">{mn.common.empty}</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={2}>{mn.common.total}</td><td className="num"><Money v={total} /></td><td colSpan={isTeacher ? 2 : 1} /></tr></tfoot>
        </Table>
      </section>
      {isTeacher && (
        <Card title={mn.expense.add}>
          <ActionForm action={addExpenseAction} submitLabel={mn.common.add}>
            <input type="hidden" name="classId" value={id} />
            <Field label={mn.common.date}><input name="date" type="date" required defaultValue={toISODate(todayDate())} className="input" /></Field>
            <Field label={mn.expense.itemTitle}><input name="title" required className="input" /></Field>
            <Field label={mn.common.amount}><input name="amount" type="number" min={1} step={1} required className="input" /></Field>
            <Field label={mn.common.note}><input name="note" className="input" /></Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
