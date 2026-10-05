import { requirePage } from "@/lib/page-auth";
import { classFundReport, monthlyFoodReport } from "@/services/reports";
import { FundReportView } from "@/components/FundReport";
import { FoodReportView } from "@/components/FoodReport";
import { MonthPicker } from "@/components/MonthPicker";
import { todayDate } from "@/lib/dates";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const actor = await requirePage("ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const [fund, food] = await Promise.all([classFundReport(actor, id), monthlyFoodReport(actor, id, year, month)]);
  return (
    <div className="flex flex-col gap-8">
      <FundReportView r={fund} classId={id} />
      <div><MonthPicker year={year} month={month} /><FoodReportView r={food} classId={id} /></div>
    </div>
  );
}
