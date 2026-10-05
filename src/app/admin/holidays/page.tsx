import { listSchoolYears } from "@/services/school-years";
import { listHolidays } from "@/services/holidays";
import { addHolidayAction, deleteHolidayAction } from "@/actions/holidays";
import { ActionForm } from "@/components/ActionForm";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const years = await listSchoolYears();
  const year = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive) ?? years[0];
  if (!year) return <p>{mn.schoolYear.noActive}</p>;
  const holidays = await listHolidays(year.id);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.holiday.title}</h1>
        <form className="mb-2 text-sm">
          <select name="year" defaultValue={year.id} className="rounded border p-1">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>{" "}
          <button className="underline">OK</button>
        </form>
        <table className="w-full border bg-white text-sm">
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-t">
                <td className="p-2">{toISODate(h.date)}</td>
                <td className="p-2">{h.name}</td>
                <td className="p-1">
                  <ActionForm action={deleteHolidayAction} submitLabel={mn.common.delete} className="inline">
                    <input type="hidden" name="id" value={h.id} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.holiday.add}</h2>
        <ActionForm action={addHolidayAction} submitLabel={mn.common.add}>
          <input type="hidden" name="schoolYearId" value={year.id} />
          <label className="text-sm">{mn.common.date}<input name="date" type="date" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
    </div>
  );
}
