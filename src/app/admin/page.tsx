import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { listSchoolYears } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { outstandingTable } from "@/services/payments";
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";

export default async function AdminHome() {
  const actor = await requirePage("ADMIN");
  const years = await listSchoolYears();
  const active = years.find((y) => y.isActive);
  if (!active) return <p>{mn.schoolYear.noActive} — <Link href="/admin/school-years" className="underline">{mn.schoolYear.create}</Link></p>;
  const [classes, rows] = await Promise.all([listClasses(active.id), outstandingTable(actor)]);
  const byClass = new Map<string, { food: number; fund: number }>();
  for (const r of rows) {
    const t = byClass.get(r.classId) ?? { food: 0, fund: 0 };
    t.food += r.foodDue;
    t.fund += r.fundDue;
    byClass.set(r.classId, t);
  }
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{active.name}</h1>
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
