import { mn } from "@/lib/i18n/mn";
export function MonthPicker({ year, month, extra }: { year: number; month: number; extra?: React.ReactNode }) {
  const years = [year - 1, year, year + 1];
  return (
    <form className="mb-3 flex items-center gap-2 text-sm">
      {extra}
      <select name="year" defaultValue={year} className="rounded border p-1">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
      <select name="month" defaultValue={month} className="rounded border p-1">{mn.months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      <button className="underline">{mn.common.apply}</button>
    </form>
  );
}
