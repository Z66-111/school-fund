import Link from "next/link";
import { listSchoolYears } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { createClassAction } from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const years = await listSchoolYears();
  const year = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive) ?? years[0];
  if (!year) return <p>{mn.schoolYear.noActive}</p>;
  const classes = await listClasses(year.id);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.nav.classes} — {year.name}</h1>
        <form className="mb-2 text-sm">
          <select name="year" defaultValue={year.id} className="rounded border p-1">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>{" "}<button className="underline">{mn.common.apply}</button>
        </form>
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.class}</th><th>{mn.common.teacher}</th><th>{mn.class.dailyFoodRate}</th><th>{mn.class.annualFundAmount}</th><th>{mn.nav.students}</th></tr></thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2"><Link href={`/admin/classes/${c.id}`} className="underline">{c.name}</Link></td>
                <td className="text-center">{c.teacher?.name ?? mn.class.noTeacher}</td>
                <td className="text-right"><Money v={c.dailyFoodRate} /></td>
                <td className="text-right"><Money v={c.annualFundAmount} /></td>
                <td className="text-center">{c._count.students}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.class.create}</h2>
        <ActionForm action={createClassAction} submitLabel={mn.common.add}>
          <input type="hidden" name="schoolYearId" value={year.id} />
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" placeholder="1А" /></label>
          <label className="text-sm">{mn.class.dailyFoodRate}<input name="dailyFoodRate" type="number" min={1} step={1} required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.class.annualFundAmount}<input name="annualFundAmount" type="number" min={1} step={1} required className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
    </div>
  );
}
