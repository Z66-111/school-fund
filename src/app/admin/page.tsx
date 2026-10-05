import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { listSchoolYears } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { outstandingTable } from "@/services/payments";
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const actor = await requirePage("ADMIN");
  const sp = await searchParams;
  const years = await listSchoolYears();
  const selected = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive);
  if (!selected) return <p>{mn.schoolYear.noActive} — <Link href="/admin/school-years" className="underline">{mn.schoolYear.create}</Link></p>;
  const [classes, rows] = await Promise.all([listClasses(selected.id), outstandingTable(actor)]);
  const classIds = new Set(classes.map((c) => c.id));
  const byClass = new Map<string, { food: number; fund: number }>();
  for (const r of rows) {
    if (!classIds.has(r.classId)) continue;
    const t = byClass.get(r.classId) ?? { food: 0, fund: 0 };
    t.food += r.foodDue;
    t.fund += r.fundDue;
    byClass.set(r.classId, t);
  }
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{selected.name}</h1>
      <form className="mb-2 text-sm">
        <select name="year" defaultValue={selected.id} className="rounded border p-1">
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>{" "}<button className="underline">{mn.common.apply}</button>
      </form>
      <table className="w-full border bg-white text-sm">
        <thead><tr><th className="p-2 text-left">{mn.common.class}</th><th>{mn.common.teacher}</th><th>{mn.nav.students}</th><th>{mn.class.foodOutstanding}</th><th>{mn.class.fundOutstanding}</th><th /><th /></tr></thead>
        <tbody>
          {classes.map((c) => {
            const t = byClass.get(c.id) ?? { food: 0, fund: 0 };
            return (
              <tr key={c.id} className="border-t">
                <td className="p-2"><Link href={`/admin/classes/${c.id}`} className="underline">{c.name}</Link></td>
                <td className="text-center">{c.teacher?.name ?? mn.class.noTeacher}</td>
                <td className="text-center">{c._count.students}</td>
                <td className="text-right"><Money v={t.food} /></td>
                <td className="text-right"><Money v={t.fund} /></td>
                <td className="p-1 text-center"><Link href={`/teacher/class/${c.id}/attendance`} className="underline">{mn.nav.attendance}</Link></td>
                <td className="p-1 text-center"><Link href={`/admin/classes/${c.id}/report`} className="underline">{mn.nav.report}</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
