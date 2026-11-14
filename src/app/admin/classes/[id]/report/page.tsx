import { requirePage } from "@/lib/page-auth";
import { classFundReport, monthlyFoodReport } from "@/services/reports";
import { getClass } from "@/services/classes";
import { FundReportView } from "@/components/FundReport";
import { FoodReportView } from "@/components/FoodReport";
import { MonthPicker } from "@/components/MonthPicker";
import { PageHeader } from "@/components/ui/PageHeader";
import { todayDate } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const mn = await getT();
  const actor = await requirePage("ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const [c, fund, food, daycare] = await Promise.all([getClass(id), classFundReport(actor, id), monthlyFoodReport(actor, id, year, month), monthlyFoodReport(actor, id, year, month, "DAYCARE")]);
  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={`${mn.nav.report}: ${mn.common.class} ${c.name}`} subtitle={c.schoolYear.name} />
      <FundReportView r={fund} classId={id} />
      <div>
        <MonthPicker year={year} month={month} />
        <div className="flex flex-col gap-8">
          <FoodReportView r={food} classId={id} />
          <FoodReportView r={daycare} classId={id} />
        </div>
      </div>
    </div>
  );
}
