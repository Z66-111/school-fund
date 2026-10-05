import { isWeekend, monthDates, toISODate } from "@/lib/dates";

export function isChargeable(date: Date, holidays: Date[]): boolean {
  if (isWeekend(date)) return false;
  const iso = toISODate(date);
  return !holidays.some((h) => toISODate(h) === iso);
}

export function chargeableDates(year: number, month: number, holidays: Date[]): Date[] {
  return monthDates(year, month).filter((d) => isChargeable(d, holidays));
}

export function countPresentDays(rows: { date: Date; status: string }[], year: number, month: number, holidays: Date[]): number {
  const chargeable = new Set(chargeableDates(year, month, holidays).map(toISODate));
  let n = 0;
  for (const r of rows) {
    if (r.status === "PRESENT" && chargeable.has(toISODate(r.date))) n++;
  }
  return n;
}

export function invoiceAmount(daysPresent: number, rate: number): number {
  return daysPresent * rate;
}

export function allocateFoodPayments<T extends { year: number; month: number; amount: number }>(
  invoices: T[],
  totalPaid: number,
): (T & { paid: number; outstanding: number })[] {
  const sorted = [...invoices].sort((a, b) => a.year - b.year || a.month - b.month);
  let remaining = Math.max(0, totalPaid);
  return sorted.map((inv) => {
    const paid = Math.min(inv.amount, remaining);
    remaining -= paid;
    return { ...inv, paid, outstanding: inv.amount - paid };
  });
}

export function foodOutstanding(invoiceTotal: number, paidTotal: number): number {
  return Math.max(0, invoiceTotal - paidTotal);
}

export function foodCredit(invoiceTotal: number, paidTotal: number): number {
  return Math.max(0, paidTotal - invoiceTotal);
}

export function fundBalance(collected: number, spent: number): number {
  return collected - spent;
}
