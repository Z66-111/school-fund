import { requirePage } from "@/lib/page-auth";
import { getActiveSchoolYear } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { monthlyFoodReport } from "@/services/reports";
import { FoodReportView } from "@/components/FoodReport";
import { MonthPicker } from "@/components/MonthPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { todayDate } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; year?: string; month?: string }> }) {
  const mn = await getT();
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const sp = await searchParams;
  const year0 = await getActiveSchoolYear();
  const classes = await listClasses(year0.id);
  const classId = sp.classId ?? classes[0]?.id;
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const picker = (
    <select name="classId" defaultValue={classId} className="input w-auto">
      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
  if (!classId) return <p className="text-ink-muted">{mn.schoolYear.noActive}</p>;
  const [r, daycare] = await Promise.all([monthlyFoodReport(actor, classId, year, month), monthlyFoodReport(actor, classId, year, month, "DAYCARE")]);
  return (
    <div>
      <PageHeader title={mn.nav.foodReport} subtitle={year0.name} />
      <MonthPicker year={year} month={month} extra={picker} />
      <div className="flex flex-col gap-8">
        <FoodReportView r={r} classId={classId} />
        <FoodReportView r={daycare} classId={classId} />
      </div>
    </div>
  );
}
