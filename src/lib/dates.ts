import { mn } from "@/lib/i18n/mn";

/** Ulaanbaatar is UTC+8, no DST. */
export const TZ_OFFSET_MINUTES = 480;

export function dateOnly(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function parseDateOnly(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(mn.errors.invalidDate);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = dateOnly(y, mo, d);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new Error(mn.errors.invalidDate);
  }
  return date;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(d: Date): boolean {
  const w = d.getUTCDay();
  return w === 0 || w === 6;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(y: number, m: number): Date[] {
  const n = daysInMonth(y, m);
  return Array.from({ length: n }, (_, i) => dateOnly(y, m, i + 1));
}

/** Today's calendar date in Ulaanbaatar, as UTC midnight. */
export function todayDate(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  return dateOnly(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

export function isFuture(d: Date, now: Date = new Date()): boolean {
  return d.getTime() > todayDate(now).getTime();
}

/** First day of month and first day of next month (exclusive end). */
export function monthRange(y: number, m: number): { start: Date; end: Date } {
  return { start: dateOnly(y, m, 1), end: new Date(Date.UTC(y, m, 1)) };
}

/** Is (y, m) strictly after the month containing `now` in UB time? */
export function isFutureMonth(y: number, m: number, now: Date = new Date()): boolean {
  const t = todayDate(now);
  return y > t.getUTCFullYear() || (y === t.getUTCFullYear() && m > t.getUTCMonth() + 1);
}
