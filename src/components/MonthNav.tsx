import Link from "next/link";
import { mn } from "@/lib/i18n/mn";
import { buttonClass } from "@/components/ui/Button";

/** Previous / current / next month stepper driven by ?year=&month= query params. */
export function MonthNav({ year, month, children }: { year: number; month: number; children?: React.ReactNode }) {
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`?year=${prev.y}&month=${prev.m}`} className={buttonClass("secondary", "sm")} aria-label={mn.attendance.prevMonth}>‹</Link>
      <span className="num min-w-36 text-center text-base font-semibold">{year} {mn.months[month - 1]}</span>
      <Link href={`?year=${next.y}&month=${next.m}`} className={buttonClass("secondary", "sm")} aria-label={mn.attendance.nextMonth}>›</Link>
      {children}
    </div>
  );
}
