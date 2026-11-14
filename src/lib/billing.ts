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

export type Charge = {
  id: string;
  year: number;
  month: number;
  /** Food: days present. Өдөр өнжүүлэх: school days charged for the month. */
  daysPresent: number;
  /** Өдөр өнжүүлэх only: days taken off this month's charge for days skipped earlier. */
  deductedDays?: number;
  rate: number;
  amount: number;
  provisional: boolean;
};

/** Running charges for months not yet closed: chargeable present days so far × the current rate, one per month. */
export function openMonthCharges(
  rows: { date: Date; status: string }[],
  closedMonths: Set<string>, // `${year}-${month}`
  holidays: Date[],
  rate: number,
  idPrefix: string,
): Charge[] {
  const months = new Map<string, { year: number; month: number }>();
  for (const r of rows) {
    const year = r.date.getUTCFullYear();
    const month = r.date.getUTCMonth() + 1;
    if (!closedMonths.has(`${year}-${month}`)) months.set(`${year}-${month}`, { year, month });
  }
  const out: Charge[] = [];
  for (const { year, month } of months.values()) {
    const daysPresent = countPresentDays(rows, year, month, holidays);
    if (daysPresent === 0) continue;
    out.push({ id: `${idPrefix}-open-${year}-${month}`, year, month, daysPresent, rate, amount: invoiceAmount(daysPresent, rate), provisional: true });
  }
  return out;
}

export function isEnrolledOn(date: Date, from: Date | null, until: Date | null): boolean {
  return !!from && date.getTime() >= from.getTime() && (!until || date.getTime() <= until.getTime());
}

/** Grid cells for one student's Өдөр өнжүүлэх month: every enrolled school day is STAYED unless it was skipped. */
export function daycareCells(
  student: { id: string; daycareFrom: Date | null; daycareUntil: Date | null },
  days: { iso: string; chargeable: boolean }[],
  skipped: Set<string>, // `${studentId}|${iso}`
): Record<string, "STAYED" | "SKIPPED"> {
  const out: Record<string, "STAYED" | "SKIPPED"> = {};
  for (const d of days) {
    if (!d.chargeable || !isEnrolledOn(new Date(`${d.iso}T00:00:00Z`), student.daycareFrom, student.daycareUntil)) continue;
    const k = `${student.id}|${d.iso}`;
    out[k] = skipped.has(k) ? "SKIPPED" : "STAYED";
  }
  return out;
}

/**
 * Prepaid Өдөр өнжүүлэх charges for one enrolled student.
 *
 * Each month is charged in full as soon as it starts: every school day of the month inside the
 * enrolment window × the daily rate. Days the child skipped are not refunded in that month;
 * they come off the next charged month instead, at that month's daily rate. If a month has
 * fewer school days than there are skipped days to deduct, the rest carries on to the month after.
 *
 * Closed months are frozen: their invoices are passed in as `frozen` and returned untouched.
 */
export function daycareCharges(o: {
  from: Date;
  until: Date | null;
  yearStart: Date;
  yearEnd: Date;
  today: Date;
  holidays: Date[];
  skips: Date[];
  rate: number;
  closedMonths: Set<string>; // `${year}-${month}`
  frozen: Charge[];
}): Charge[] {
  const out = [...o.frozen];
  const start = o.from.getTime() > o.yearStart.getTime() ? o.from : o.yearStart;
  const end = o.until && o.until.getTime() < o.yearEnd.getTime() ? o.until : o.yearEnd;
  const last = end.getTime() < o.today.getTime() ? end : o.today; // a month is charged once it has begun
  if (start.getTime() > last.getTime()) return out;

  const skipped = new Set(o.skips.map(toISODate));
  const frozenBy = new Map(o.frozen.map((c) => [`${c.year}-${c.month}`, c]));
  const lastY = last.getUTCFullYear();
  const lastM = last.getUTCMonth() + 1;
  let carry = 0; // skipped days still waiting to be deducted
  let prevDays: string[] = []; // the charged school days of the month before
  for (let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1; y < lastY || (y === lastY && m <= lastM); m === 12 ? (y++, (m = 1)) : m++) {
    const days = chargeableDates(y, m, o.holidays)
      .filter((d) => d.getTime() >= start.getTime() && d.getTime() <= end.getTime())
      .map(toISODate);
    const toDeduct = carry + prevDays.filter((d) => skipped.has(d)).length;
    const key = `${y}-${m}`;
    if (o.closedMonths.has(key)) {
      const inv = frozenBy.get(key);
      carry = toDeduct - Math.min(toDeduct, inv?.deductedDays ?? 0);
      prevDays = inv ? days : []; // a closed month with no invoice was never charged, so nothing to give back
      continue;
    }
    if (days.length === 0) {
      carry = toDeduct;
      prevDays = [];
      continue;
    }
    const deductedDays = Math.min(days.length, toDeduct);
    carry = toDeduct - deductedDays;
    prevDays = days;
    out.push({ id: `daycare-open-${y}-${m}`, year: y, month: m, daysPresent: days.length, deductedDays, rate: o.rate, amount: invoiceAmount(days.length - deductedDays, o.rate), provisional: true });
  }
  return out;
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
