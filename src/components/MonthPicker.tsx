import { getT } from "@/lib/i18n/server";
import { buttonClass } from "@/components/ui/Button";

export async function MonthPicker({ year, month, extra }: { year: number; month: number; extra?: React.ReactNode }) {
  const mn = await getT();
  const years = [year - 1, year, year + 1];
  return (
    <form className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      {extra}
      <select name="year" defaultValue={year} className="input w-auto">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select name="month" defaultValue={month} className="input w-auto">
        {mn.months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <button className={buttonClass("secondary", "sm")}>{mn.common.apply}</button>
    </form>
  );
}
