import { requireClassPage } from "@/lib/page-auth";
import { listExpenses } from "@/services/expenses";
import { addExpenseAction, updateExpenseAction, deleteExpenseAction } from "@/actions/expenses";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { toISODate, todayDate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const isTeacher = actor.role === "TEACHER";
  const expenses = await listExpenses(actor, id);
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className={isTeacher ? "md:col-span-2" : "md:col-span-3"}>
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.date}</th><th className="text-left">{mn.expense.itemTitle}</th><th>{mn.common.amount}</th><th className="text-left">{mn.common.note}</th>{isTeacher && <th>{mn.common.actions}</th>}</tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t align-top">
                <td className="p-2">{toISODate(e.date)}</td>
                <td className="p-2">{e.title}</td>
                <td className="p-2 text-right"><Money v={e.amount} /></td>
                <td className="p-2">{e.note}</td>
                {isTeacher && <td className="p-2">
                  <details>
                    <summary className="cursor-pointer text-blue-700">{mn.common.edit}</summary>
                    <ActionForm action={updateExpenseAction} submitLabel={mn.common.save}>
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="expenseId" value={e.id} />
                      <input name="date" type="date" defaultValue={toISODate(e.date)} className="rounded border p-1" />
                      <input name="title" defaultValue={e.title} className="rounded border p-1" />
                      <input name="amount" type="number" min={1} step={1} defaultValue={e.amount} className="rounded border p-1" />
                      <input name="note" defaultValue={e.note} className="rounded border p-1" />
                    </ActionForm>
                  </details>
                  <ActionForm action={deleteExpenseAction} submitLabel={mn.common.delete} className="inline">
                    <input type="hidden" name="classId" value={id} />
                    <input type="hidden" name="expenseId" value={e.id} />
                  </ActionForm>
                </td>}
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>{mn.common.total}</td><td className="p-2 text-right"><Money v={total} /></td><td colSpan={isTeacher ? 2 : 1} /></tr></tfoot>
        </table>
      </section>
      {isTeacher && <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.expense.add}</h2>
        <ActionForm action={addExpenseAction} submitLabel={mn.common.add}>
          <input type="hidden" name="classId" value={id} />
          <input name="date" type="date" required defaultValue={toISODate(todayDate())} className="rounded border p-1" />
          <input name="title" required placeholder={mn.expense.itemTitle} className="rounded border p-1" />
          <input name="amount" type="number" min={1} step={1} required placeholder={mn.common.amount} className="rounded border p-1" />
          <input name="note" placeholder={mn.common.note} className="rounded border p-1" />
        </ActionForm>
      </section>}
    </div>
  );
}
