import { listSchoolYears } from "@/services/school-years";
import { createSchoolYearAction, activateSchoolYearAction } from "@/actions/school-years";
import { ActionForm } from "@/components/ActionForm";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  const years = await listSchoolYears();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.schoolYear.title}</h1>
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.name}</th><th>{mn.schoolYear.startDate}</th><th>{mn.schoolYear.endDate}</th><th>{mn.common.status}</th><th /></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.id} className="border-t">
                <td className="p-2">{y.name}</td>
                <td className="text-center">{toISODate(y.startDate)}</td>
                <td className="text-center">{toISODate(y.endDate)}</td>
                <td className="text-center">{y.isActive ? mn.common.active : mn.common.inactive}</td>
                <td className="p-1">
                  {!y.isActive && (
                    <ActionForm action={activateSchoolYearAction} submitLabel={mn.common.activate} className="inline">
                      <input type="hidden" name="id" value={y.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.schoolYear.create}</h2>
        <ActionForm action={createSchoolYearAction} submitLabel={mn.common.add}>
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" placeholder="2026-2027" /></label>
          <label className="text-sm">{mn.schoolYear.startDate}<input name="startDate" type="date" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.schoolYear.endDate}<input name="endDate" type="date" required className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
    </div>
  );
}
