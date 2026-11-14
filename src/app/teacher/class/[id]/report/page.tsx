import { requireClassPage } from "@/lib/page-auth";
import { monthlyFoodReport } from "@/services/reports";
import { FoodReportView } from "@/components/FoodReport";
import { MonthPicker } from "@/components/MonthPicker";
import { todayDate } from "@/lib/dates";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const sp = await searchParams;
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const [food, daycare] = await Promise.all([monthlyFoodReport(actor, id, year, month), monthlyFoodReport(actor, id, year, month, "DAYCARE")]);
  return (
    <div>
      <MonthPicker year={year} month={month} />
      <div className="flex flex-col gap-8">
        <FoodReportView r={food} classId={id} />
        <FoodReportView r={daycare} classId={id} />
      </div>
    </div>
  );
}
