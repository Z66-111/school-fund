import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { listSchoolYears } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { outstandingTable } from "@/services/payments";
import { Money } from "@/components/Money";
import { Table } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { buttonClass } from "@/components/ui/Button";
import { getT } from "@/lib/i18n/server";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const mn = await getT();
  const actor = await requirePage("ADMIN");
  const sp = await searchParams;
  const years = await listSchoolYears();
  const selected = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive);
  if (!selected) {
    return (
      <div className="panel max-w-md">
        <p className="mb-3">{mn.schoolYear.noActive}</p>
        <Link href="/admin/school-years" className={buttonClass("primary")}>{mn.schoolYear.create}</Link>
      </div>
    );
  }
  const [classes, rows] = await Promise.all([listClasses(selected.id), outstandingTable(actor)]);
  const classIds = new Set(classes.map((c) => c.id));
  const byClass = new Map<string, { food: number; daycare: number; fund: number }>();
  let food = 0, daycare = 0, fund = 0;
  for (const r of rows) {
    if (!classIds.has(r.classId)) continue;
    const t = byClass.get(r.classId) ?? { food: 0, daycare: 0, fund: 0 };
    t.food += r.foodDue;
    t.daycare += r.daycareDue;
    t.fund += r.fundDue;
    byClass.set(r.classId, t);
    food += r.foodDue;
    daycare += r.daycareDue;
    fund += r.fundDue;
  }
  return (
    <div>
      <PageHeader title={mn.schoolYear.title} subtitle={selected.name}>
        <form className="flex items-center gap-2">
          <select name="year" defaultValue={selected.id} className="input w-auto">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <button className={buttonClass("secondary", "sm")}>{mn.common.apply}</button>
        </form>
      </PageHeader>
      <div className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatTile label={mn.nav.classes} value={String(classes.length)} money={false} tone="neutral" />
        <StatTile label={mn.class.foodOutstanding} value={food} tone={food > 0 ? "due" : "good"} />
        <StatTile label={mn.class.daycareOutstanding} value={daycare} tone={daycare > 0 ? "due" : "good"} />
        <StatTile label={mn.class.fundOutstanding} value={fund} tone={fund > 0 ? "due" : "good"} />
      </div>
      <Table>
        <thead><tr><th>{mn.common.class}</th><th>{mn.common.teacher}</th><th className="ctr">{mn.nav.students}</th><th className="num">{mn.class.foodOutstanding}</th><th className="num">{mn.class.daycareOutstanding}</th><th className="num">{mn.class.fundOutstanding}</th><th /></tr></thead>
        <tbody>
          {classes.map((c) => {
            const t = byClass.get(c.id) ?? { food: 0, daycare: 0, fund: 0 };
            return (
              <tr key={c.id}>
                <td><Link href={`/admin/classes/${c.id}`} className="link font-medium">{c.name}</Link></td>
                <td className={c.teacher ? "" : "text-ink-muted"}>{c.teacher?.name ?? mn.class.noTeacher}</td>
                <td className="ctr num">{c._count.students}</td>
                <td className="num"><Money v={t.food} /></td>
                <td className="num"><Money v={t.daycare} /></td>
                <td className="num"><Money v={t.fund} /></td>
                <td className="whitespace-nowrap text-right">
                  <Link href={`/teacher/class/${c.id}/attendance`} className="link mr-3">{mn.nav.attendance}</Link>
                  <Link href={`/admin/classes/${c.id}/report`} className="link">{mn.nav.report}</Link>
                </td>
              </tr>
            );
          })}
          {classes.length === 0 && <tr><td colSpan={7} className="text-ink-muted">{mn.common.empty}</td></tr>}
        </tbody>
      </Table>
    </div>
  );
}
