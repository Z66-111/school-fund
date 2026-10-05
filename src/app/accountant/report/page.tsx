import { requirePage } from "@/lib/page-auth";
import { getActiveSchoolYear } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { monthlyFoodReport } from "@/services/reports";
import { FoodReportView } from "@/components/FoodReport";
import { MonthPicker } from "@/components/MonthPicker";
import { todayDate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; year?: string; month?: string }> }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const sp = await searchParams;
  const year0 = await getActiveSchoolYear();
  const classes = await listClasses(year0.id);
  const classId = sp.classId ?? classes[0]?.id;
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const picker = (
    <select name="classId" defaultValue={classId} className="rounded border p-1">
      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
  if (!classId) return <p>{mn.schoolYear.noActive}</p>;
  const r = await monthlyFoodReport(actor, classId, year, month);
  return (
    <div>
      <MonthPicker year={year} month={month} extra={picker} />
      <FoodReportView r={r} classId={classId} />
    </div>
  );
}
