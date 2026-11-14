// Reads a class attendance workbook the way teachers keep it in Excel: one sheet per month,
// a header row with the day numbers, one row per child, and a mark only where the child was away.
//
//   №  | ФИО ребёнка      | 1 | 2 | 5 | 6 | ... | дней
//   1  | Дулам Сувд |   | н |   |   | ... | 21
//   ...
//   Итого                 ...
//
// Blank = present, «н» = absent, «б» = sick. Everything here is pure; the service decides what to save.

export type SheetMark = "PRESENT" | "ABSENT" | "SICK";
export type ParsedSheet = {
  sheet: string;
  month: number | null; // 1-12, from the sheet name
  days: number[];
  rows: { name: string; marks: Record<number, SheetMark>; unknownMarks: number }[];
};

const MONTHS: string[][] = [
  ["январь", "january"], ["февраль", "february"], ["март", "march"], ["апрель", "april"], ["май", "may"], ["июнь", "june"],
  ["июль", "july"], ["август", "august"], ["сентябрь", "september"], ["октябрь", "october"], ["ноябрь", "november"], ["декабрь", "december"],
];

/** Month of a sheet named in Russian or English ("октябрь", "Окт", "October"), Mongolian ("10-р сар", "10 сар") or as a bare number. */
export function sheetMonth(name: string): number | null {
  const n = name.trim().toLowerCase();
  const num = /^(\d{1,2})(\s*-?\s*р)?(\s*сар)?$/.exec(n) ?? /^(?:\d{4}\D)?(\d{1,2})$/.exec(n);
  if (num) {
    const m = Number(num[1]);
    return m >= 1 && m <= 12 ? m : null;
  }
  const word = n.replace(/[^\p{L}]/gu, "");
  if (word.length < 3) return null;
  const i = MONTHS.findIndex((names) => names.some((full) => full.startsWith(word) || word.startsWith(full)));
  return i === -1 ? null : i + 1;
}

const dayNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,2}(\.0+)?$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

const MARKS: Record<string, SheetMark> = { "н": "ABSENT", h: "ABSENT", n: "ABSENT", "б": "SICK" }; // Latin h/n: look-alikes typed on the wrong layout

export function parseAttendanceSheet(sheet: string, data: unknown[][]): ParsedSheet {
  const out: ParsedSheet = { sheet, month: sheetMonth(sheet), days: [], rows: [] };
  // The header is the first row near the top holding several day numbers.
  const headerAt = data.slice(0, 15).findIndex((row) => row.filter((v) => dayNumber(v) !== null).length >= 3);
  if (headerAt === -1) return out;
  const header = data[headerAt];
  const dayCols: { col: number; day: number }[] = [];
  header.forEach((v, col) => {
    const day = dayNumber(v);
    if (day !== null && !dayCols.some((d) => d.day === day)) dayCols.push({ col, day });
  });
  const nameCol = dayCols[0].col - 1;
  if (nameCol < 0) return out;
  out.days = dayCols.map((d) => d.day);
  for (const row of data.slice(headerAt + 1)) {
    const raw = row[nameCol];
    if (typeof raw !== "string" || !/\p{L}/u.test(raw)) continue; // totals and empty rows carry no name
    const name = raw.replace(/\s+/g, " ").trim();
    if (/^(итого|нийт|всего|total)(?!\p{L})/iu.test(name) || row.slice(0, nameCol).some((v) => typeof v === "string" && /^(итого|нийт|всего|total)/i.test(v.trim()))) continue;
    const marks: Record<number, SheetMark> = {};
    let unknownMarks = 0;
    for (const { col, day } of dayCols) {
      const v = row[col];
      const text = v === null || v === undefined ? "" : String(v).trim().toLowerCase();
      if (text === "") marks[day] = "PRESENT";
      else if (MARKS[text]) marks[day] = MARKS[text];
      else unknownMarks++;
    }
    out.rows.push({ name, marks, unknownMarks });
  }
  return out;
}

/**
 * Names are compared without case or extra spaces, and with о/ө/у/ү treated as one letter: on a
 * Russian keyboard «Мөнх» is typed «Мунх» by some and «Монх» by others.
 */
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().replace(/[өүу]/g, "о").replace(/ё/g, "е");
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Pairs sheet names with students. Exact (normalized) matches first; a leftover name is then
 * accepted as a typo of a leftover student only when it is within two letters of exactly one of them.
 */
export function matchNames(
  sheetNames: string[],
  students: { id: string; name: string }[],
): { matched: Map<string, { id: string; name: string; approximate: boolean }>; unmatched: string[] } {
  const matched = new Map<string, { id: string; name: string; approximate: boolean }>();
  const free = new Map(students.map((s) => [s.id, s]));
  const pending: string[] = [];
  for (const n of sheetNames) {
    const hit = [...free.values()].find((s) => normalizeName(s.name) === normalizeName(n));
    if (hit) {
      matched.set(n, { ...hit, approximate: false });
      free.delete(hit.id);
    } else pending.push(n);
  }
  const unmatched: string[] = [];
  for (const n of pending) {
    const key = normalizeName(n);
    const near = key.length < 6 ? [] : [...free.values()].filter((s) => distance(key, normalizeName(s.name)) <= 2);
    if (near.length === 1) {
      matched.set(n, { ...near[0], approximate: true });
      free.delete(near[0].id);
    } else unmatched.push(n);
  }
  return { matched, unmatched };
}
