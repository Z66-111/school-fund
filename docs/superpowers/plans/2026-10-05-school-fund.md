# School Fund Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Mongolian-language web app where teachers mark attendance, the app bills parents monthly for food by days present, an accountant registers bank payments, and each class tracks an annual fund with contributions, expenses and a report.

**Architecture:** Next.js App Router with server actions. All business rules and authorization live in plain TypeScript "services" (`src/services/*`) that take an `Actor` and are tested directly with Vitest against SQLite. Server actions (`src/actions/*`) are thin: read the session, call a service, translate errors into form results. Pages are server components grouped by role under `src/app/{admin,teacher,accountant,parent}` and each role's layout enforces the role.

**Tech Stack:** Next.js 15+ (TypeScript, App Router), Prisma 6 + SQLite (Postgres later by changing the datasource provider), bcryptjs, Zod, Tailwind CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-school-fund-design.md`

## Global Constraints

- All UI strings come from `src/lib/i18n/mn.ts`. No hard-coded Mongolian or English in components.
- Money is `Int` MNT (tögrög). Inputs accept positive integers only; display with `formatMNT()` as `3,000 ₮`.
- Calendar dates are stored as `DateTime` at UTC midnight. "Today" is computed with the Ulaanbaatar offset (UTC+8) via `todayDate()`.
- Role, attendance status and payment kind are `String` columns validated by Zod, never Prisma enums.
- Emails are normalized with `.trim().toLowerCase()` before storing or looking up.
- Every service function takes `actor: Actor` first and starts with `requireRole(...)`; authorization is never only in the UI.
- Soft-deleted payments (`deletedAt != null`) are excluded from every sum and list unless the list is the deletion audit log.
- Unmarked attendance days count as absent. Weekends and holidays are never chargeable.
- Pinned majors: `prisma@6` / `@prisma/client@6` (Prisma 7 changed the generator and datasource setup) and `zod@3` (Zod 4 removed `invalid_type_error`). Do not upgrade them during this plan.
- Commit after each task with the message shown in the task.

## Review Focus

1. **Daily rate changed after some months were closed** — earlier invoices keep the rate they were closed with; only new closes use the new rate. (Test in Task 10.)
2. **Student deactivated before month close** — not invoiced for that month, but earlier invoices still appear in the accountant's outstanding table. (Test in Task 10 and Task 11.)
3. **Parent linked to children in two classes** — can read both classes' reports and nothing else. (Test in Task 4.)
4. **Payment larger than outstanding** — allocation shows the overpaid invoice as fully paid, outstanding never below 0, and the excess shows as credit. (Test in Task 8.)
5. **Email typed with capitals or spaces** at login and when linking a parent — still matches the stored account. (Test in Task 3 and Task 7.)

---

## File Structure

```
prisma/schema.prisma            data model
prisma/seed.ts                  demo data
src/lib/db.ts                   Prisma client singleton
src/lib/roles.ts                Role, Actor types
src/lib/errors.ts               AppError, ForbiddenError, ValidationError, NotFoundError
src/lib/validate.ts             parse(schema, data) -> throws ValidationError
src/lib/money.ts                formatMNT, moneySchema
src/lib/dates.ts                dateOnly, parseDateOnly, toISODate, isWeekend, monthDates, todayDate, isFuture
src/lib/billing.ts              pure billing math
src/lib/password.ts             hashPassword, verifyPassword
src/lib/session.ts              cookie session (server only)
src/lib/page-auth.ts            requirePage(...roles) for layouts/pages
src/lib/authz.ts                requireRole, assertClassAccess, assertStudentAccess
src/lib/i18n/mn.ts              all strings
src/lib/action.ts               ActionResult, runAction
src/services/*.ts               business logic per domain
src/actions/*.ts                server actions per domain
src/components/*.tsx            ActionForm, Nav, Money, tables
src/app/...                     routes
tests/helpers/db.ts             resetDb, factories
tests/setup.ts, tests/global-setup.ts
tests/unit/*.test.ts            pure functions
tests/services/*.test.ts        services against SQLite
e2e/smoke.spec.ts               Playwright
```

---

### Task 1: Project scaffold, i18n, money and date helpers

**Files:**
- Create: Next.js app via create-next-app, `vitest.config.ts`, `src/lib/i18n/mn.ts`, `src/lib/money.ts`, `src/lib/dates.ts`, `src/lib/roles.ts`, `src/lib/errors.ts`, `src/lib/validate.ts`
- Test: `tests/unit/money.test.ts`, `tests/unit/dates.test.ts`

**Interfaces:**
- Produces: `formatMNT(n: number): string`, `moneySchema` (Zod, positive int), `dateOnly(y,m,d): Date`, `parseDateOnly(s: string): Date`, `toISODate(d: Date): string`, `isWeekend(d: Date): boolean`, `daysInMonth(y,m): number`, `monthDates(y,m): Date[]`, `todayDate(now?: Date): Date`, `isFuture(d: Date, now?: Date): boolean`, `monthRange(y,m): { start: Date; end: Date }`, `isFutureMonth(y, m, now?: Date): boolean`, `Role`, `Actor`, `AppError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `parse(schema, data)`, `mn`.

- [ ] **Step 1: Scaffold Next.js into the existing folder**

The folder already has `docs/` and `.git`, so scaffold into a temp dir and copy:

```bash
cd /Users/munkhzayaamarzaya/Documents/school-fund
npx --yes create-next-app@latest sf-tmp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
rsync -a sf-tmp/ ./ && rm -rf sf-tmp
npm install @prisma/client@6 zod@3 bcryptjs server-only
npm install -D prisma@6 vitest tsx @types/bcryptjs @types/node
printf '\n# local db\n*.db\n*.db-journal\n/test-results\n/playwright-report\n' >> .gitignore
```

- [ ] **Step 2: Add Vitest config and npm scripts**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: { DATABASE_URL: "file:./test.db" },
    fileParallelism: false,
  },
});
```

Create placeholder `tests/setup.ts` (filled in Task 2):

```ts
export {};
```

Create placeholder `tests/global-setup.ts` (filled in Task 2):

```ts
export default async function () {}
```

Add to `package.json` `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest",
"db:push": "prisma db push",
"db:seed": "tsx prisma/seed.ts",
"e2e": "playwright test"
```

- [ ] **Step 3: Write roles, errors, validate**

`src/lib/roles.ts`:

```ts
export const ROLES = ["ADMIN", "TEACHER", "ACCOUNTANT", "PARENT"] as const;
export type Role = (typeof ROLES)[number];
export type Actor = { userId: string; role: Role };

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PAYMENT_KINDS = ["FOOD", "ANNUAL_FUND"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
```

`src/lib/errors.ts`:

```ts
import { mn } from "@/lib/i18n/mn";

export class AppError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AppError";
  }
}
export class ForbiddenError extends AppError {
  constructor() {
    super("FORBIDDEN", mn.errors.forbidden);
  }
}
export class NotFoundError extends AppError {
  constructor() {
    super("NOT_FOUND", mn.errors.notFound);
  }
}
export class ValidationError extends AppError {
  constructor(public fieldErrors: Record<string, string[]>) {
    super("VALIDATION", mn.errors.validation);
  }
}
```

`src/lib/validate.ts`:

```ts
import { z } from "zod";
import { ValidationError } from "@/lib/errors";

export function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fe: Record<string, string[]> = {};
    for (const issue of r.error.issues) {
      const key = issue.path.join(".") || "_";
      (fe[key] ??= []).push(issue.message);
    }
    throw new ValidationError(fe);
  }
  return r.data;
}

/** FormData -> plain object (first value per key). */
export function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  return o;
}
```

- [ ] **Step 4: Write the i18n strings file**

`src/lib/i18n/mn.ts`:

```ts
export const mn = {
  app: "Сургуулийн сан",
  nav: {
    logout: "Гарах",
    admin: "Админ",
    classes: "Ангиуд",
    users: "Хэрэглэгчид",
    holidays: "Амралтын өдрүүд",
    schoolYears: "Хичээлийн жил",
    attendance: "Ирц",
    students: "Сурагчид",
    expenses: "Зарлага",
    report: "Тайлан",
    outstanding: "Үлдэгдэл",
    payments: "Төлбөрүүд",
    foodReport: "Хоолны тайлан",
    myChildren: "Миний хүүхдүүд",
  },
  roles: { ADMIN: "Админ", TEACHER: "Багш", ACCOUNTANT: "Нягтлан", PARENT: "Эцэг эх" },
  login: { title: "Нэвтрэх", email: "И-мэйл", password: "Нууц үг", submit: "Нэвтрэх" },
  common: {
    name: "Нэр",
    date: "Огноо",
    amount: "Дүн",
    note: "Тэмдэглэл",
    add: "Нэмэх",
    save: "Хадгалах",
    delete: "Устгах",
    edit: "Засах",
    cancel: "Болих",
    actions: "Үйлдэл",
    year: "Он",
    month: "Сар",
    active: "Идэвхтэй",
    inactive: "Идэвхгүй",
    activate: "Идэвхжүүлэх",
    deactivate: "Идэвхгүй болгох",
    downloadCsv: "CSV татах",
    total: "Нийт",
    class: "Анги",
    student: "Сурагч",
    teacher: "Багш",
    none: "—",
    filterAll: "Бүх анги",
    reason: "Шалтгаан",
    email: "И-мэйл",
    password: "Нууц үг",
    tempPassword: "Түр нууц үг",
    role: "Эрх",
    status: "Төлөв",
    yes: "Тийм",
    no: "Үгүй",
  },
  schoolYear: {
    title: "Хичээлийн жил",
    startDate: "Эхлэх огноо",
    endDate: "Дуусах огноо",
    isActive: "Идэвхтэй жил",
    create: "Хичээлийн жил үүсгэх",
    noActive: "Идэвхтэй хичээлийн жил байхгүй",
  },
  holiday: { title: "Амралтын өдрүүд", add: "Амралтын өдөр нэмэх" },
  class: {
    title: "Анги",
    create: "Анги үүсгэх",
    dailyFoodRate: "Өдрийн хоолны үнэ",
    annualFundAmount: "Жилийн сангийн хураамж (нэг сурагч)",
    assignTeacher: "Багш оноох",
    noTeacher: "Багшгүй",
    noClass: "Танд оноогдсон анги байхгүй",
    foodOutstanding: "Хоолны үлдэгдэл",
    fundOutstanding: "Сангийн үлдэгдэл",
  },
  user: {
    create: "Хэрэглэгч үүсгэх",
    resetPassword: "Нууц үг шинэчлэх",
    newPassword: "Шинэ нууц үг",
  },
  student: {
    add: "Сурагч нэмэх",
    parents: "Эцэг эх",
    linkParent: "Эцэг эх холбох (и-мэйлээр)",
    createParent: "Эцэг эхийн бүртгэл үүсгэх",
    parentCreated: "Эцэг эхийн бүртгэл үүсгэгдлээ. Түр нууц үг:",
    showInactive: "Идэвхгүй сурагчдыг харуулах",
  },
  attendance: {
    title: "Ирц",
    present: "Ирсэн",
    absent: "Тасалсан",
    unmarked: "Тэмдэглээгүй",
    presentShort: "И",
    absentShort: "Т",
    markAllPresentToday: "Өнөөдөр бүгд ирсэн",
    daysPresent: "Ирсэн өдөр",
    closeMonth: "Сар хаах",
    reopenMonth: "Сар нээх",
    closed: "Хаагдсан",
    closedAt: "Хаасан",
    confirmClose: "Энэ сарыг хаахдаа итгэлтэй байна уу? Сурагч бүрт хоолны нэхэмжлэх үүснэ.",
  },
  invoice: {
    title: "Хоолны нэхэмжлэх",
    rate: "Үнэ",
    amount: "Дүн",
    paid: "Төлсөн",
    outstanding: "Үлдэгдэл",
    credit: "Илүү төлөлт",
  },
  payment: {
    title: "Төлбөр",
    register: "Төлбөр бүртгэх",
    kind: "Төрөл",
    FOOD: "Хоолны мөнгө",
    ANNUAL_FUND: "Жилийн сан",
    paidAt: "Төлсөн огноо",
    registeredBy: "Бүртгэсэн",
    deleted: "Устгасан",
    deleteReason: "Устгасан шалтгаан",
    foodDue: "Хоолны өр",
    fundDue: "Сангийн өр",
    history: "Төлбөрийн түүх",
  },
  expense: { title: "Зарлага", add: "Зарлага нэмэх", itemTitle: "Зүйл" },
  report: {
    fund: "Жилийн сангийн тайлан",
    collected: "Цугларсан",
    spent: "Зарцуулсан",
    balance: "Үлдэгдэл",
    contributions: "Хураамжийн төлөлт",
    due: "Төлөх",
    food: "Сарын хоолны тайлан",
  },
  parent: { selectChild: "Хүүхэд сонгох", noChildren: "Холбогдсон хүүхэд байхгүй" },
  months: ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"],
  weekdaysShort: ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"],
  errors: {
    forbidden: "Хандах эрхгүй",
    loginRequired: "Нэвтрэх шаардлагатай",
    validation: "Оруулсан мэдээлэл буруу байна",
    invalidCredentials: "И-мэйл эсвэл нууц үг буруу",
    notFound: "Олдсонгүй",
    emailTaken: "Энэ и-мэйл бүртгэлтэй байна",
    monthAlreadyClosed: "Энэ сар аль хэдийн хаагдсан",
    monthClosed: "Хаагдсан сарын ирцийг өөрчлөх боломжгүй",
    futureDate: "Ирээдүйн огноо оруулах боломжгүй",
    futureMonth: "Ирээдүйн сарыг хаах боломжгүй",
    monthNotClosed: "Энэ сар хаагдаагүй байна",
    reopenBlocked: "Хаасны дараа төлбөр бүртгэгдсэн тул сарыг нээх боломжгүй",
    studentHasRecords: "Бүртгэлтэй сурагчийг устгах боломжгүй. Идэвхгүй болгоно уу.",
    nonChargeableDay: "Амралтын өдөр ирц бүртгэхгүй",
    notOwnPayment: "Зөвхөн өөрийн бүртгэсэн төлбөрийг устгах боломжтой",
    noActiveYear: "Идэвхтэй хичээлийн жил байхгүй",
    positiveInt: "Эерэг бүхэл тоо оруулна уу",
    required: "Заавал бөглөнө",
    invalidDate: "Огноо буруу (ЖЖЖЖ-СС-ӨӨ)",
    notTeacher: "Сонгосон хэрэглэгч багш биш",
    notParent: "Энэ и-мэйлтэй хэрэглэгч эцэг эх биш",
    dateOutsideYear: "Огноо хичээлийн жилийн гадна байна",
  },
} as const;
```

- [ ] **Step 5: Write failing tests for money and dates**

`tests/unit/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatMNT, moneySchema } from "@/lib/money";

describe("formatMNT", () => {
  it("groups thousands and appends ₮", () => {
    expect(formatMNT(3000)).toBe("3,000 ₮");
    expect(formatMNT(1234567)).toBe("1,234,567 ₮");
    expect(formatMNT(0)).toBe("0 ₮");
  });
  it("formats negatives with a leading minus", () => {
    expect(formatMNT(-500)).toBe("-500 ₮");
  });
});

describe("moneySchema", () => {
  it("accepts positive integers from strings", () => {
    expect(moneySchema.parse("3000")).toBe(3000);
    expect(moneySchema.parse(3000)).toBe(3000);
  });
  it("rejects zero, negatives, decimals, empty", () => {
    for (const bad of ["0", "-1", "3.5", "", "abc"]) {
      expect(moneySchema.safeParse(bad).success).toBe(false);
    }
  });
});
```

`tests/unit/dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dateOnly, parseDateOnly, toISODate, isWeekend, daysInMonth, monthDates, todayDate, isFuture } from "@/lib/dates";

describe("dates", () => {
  it("dateOnly builds UTC midnight", () => {
    expect(dateOnly(2026, 10, 5).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("parseDateOnly round-trips and rejects junk", () => {
    expect(toISODate(parseDateOnly("2026-02-28"))).toBe("2026-02-28");
    expect(() => parseDateOnly("2026-2-8")).toThrow();
    expect(() => parseDateOnly("2026-13-01")).toThrow();
    expect(() => parseDateOnly("2026-02-30")).toThrow();
  });
  it("isWeekend", () => {
    expect(isWeekend(dateOnly(2026, 10, 3))).toBe(true); // Saturday
    expect(isWeekend(dateOnly(2026, 10, 4))).toBe(true); // Sunday
    expect(isWeekend(dateOnly(2026, 10, 5))).toBe(false); // Monday
  });
  it("daysInMonth and monthDates", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    const d = monthDates(2026, 10);
    expect(d).toHaveLength(31);
    expect(toISODate(d[0])).toBe("2026-10-01");
    expect(toISODate(d[30])).toBe("2026-10-31");
  });
  it("todayDate uses Ulaanbaatar offset", () => {
    // 2026-10-05 20:00 UTC is already 2026-10-06 in UB
    expect(toISODate(todayDate(new Date("2026-10-05T20:00:00Z")))).toBe("2026-10-06");
    expect(toISODate(todayDate(new Date("2026-10-05T10:00:00Z")))).toBe("2026-10-05");
  });
  it("isFuture compares against UB today", () => {
    const now = new Date("2026-10-05T10:00:00Z");
    expect(isFuture(dateOnly(2026, 10, 6), now)).toBe(true);
    expect(isFuture(dateOnly(2026, 10, 5), now)).toBe(false);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/money` and `@/lib/dates`.

- [ ] **Step 7: Implement money and dates**

`src/lib/money.ts`:

```ts
import { z } from "zod";
import { mn } from "@/lib/i18n/mn";

export function formatMNT(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-US")} ₮`;
}

export const moneySchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.coerce.number({ invalid_type_error: mn.errors.positiveInt }).int(mn.errors.positiveInt).positive(mn.errors.positiveInt),
);
```

`src/lib/dates.ts`:

```ts
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
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 2 files.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest, i18n strings, money and date helpers"
```

---

### Task 2: Prisma schema, client, seed, test DB helpers

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db.ts`, `src/lib/password.ts`, `.env`, `tests/helpers/db.ts`
- Modify: `tests/setup.ts`, `tests/global-setup.ts`, `package.json` (prisma seed config)
- Test: `tests/services/db.test.ts`

**Interfaces:**
- Produces: `prisma` client; `hashPassword(p): Promise<string>`, `verifyPassword(p, hash): Promise<boolean>`; test factories `f.user(role, o?)`, `f.schoolYear(o?)`, `f.klass(o?)`, `f.student(classId, o?)`, `f.link(parentId, studentId)`, `f.holiday(schoolYearId, date, name?)`, `actorOf(user)`, `resetDb()`.

- [ ] **Step 1: Write the schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         String
  createdAt    DateTime @default(now())

  sessions           Session[]
  classes            Class[]         @relation("ClassTeacher")
  children           ParentStudent[]
  paymentsRegistered Payment[]
  expenses           Expense[]
  monthCloses        MonthClose[]
}

model Session {
  id        String   @id
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
}

model SchoolYear {
  id        String   @id @default(cuid())
  name      String   @unique
  startDate DateTime
  endDate   DateTime
  isActive  Boolean  @default(false)

  classes  Class[]
  holidays Holiday[]
  expenses Expense[]
}

model Holiday {
  id           String     @id @default(cuid())
  schoolYearId String
  schoolYear   SchoolYear @relation(fields: [schoolYearId], references: [id], onDelete: Cascade)
  date         DateTime
  name         String

  @@unique([schoolYearId, date])
}

model Class {
  id               String     @id @default(cuid())
  name             String
  schoolYearId     String
  schoolYear       SchoolYear @relation(fields: [schoolYearId], references: [id])
  teacherId        String?
  teacher          User?      @relation("ClassTeacher", fields: [teacherId], references: [id])
  dailyFoodRate    Int
  annualFundAmount Int

  students    Student[]
  monthCloses MonthClose[]
  expenses    Expense[]

  @@unique([schoolYearId, name])
}

model Student {
  id       String  @id @default(cuid())
  classId  String
  class    Class   @relation(fields: [classId], references: [id])
  name     String
  isActive Boolean @default(true)

  parents    ParentStudent[]
  attendance Attendance[]
  invoices   FoodInvoice[]
  payments   Payment[]
}

model ParentStudent {
  parentUserId String
  parent       User    @relation(fields: [parentUserId], references: [id], onDelete: Cascade)
  studentId    String
  student      Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@id([parentUserId, studentId])
}

model Attendance {
  id        String   @id @default(cuid())
  studentId String
  student   Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  date      DateTime
  status    String

  @@unique([studentId, date])
}

model MonthClose {
  id         String   @id @default(cuid())
  classId    String
  class      Class    @relation(fields: [classId], references: [id])
  year       Int
  month      Int
  closedAt   DateTime @default(now())
  closedById String
  closedBy   User     @relation(fields: [closedById], references: [id])

  invoices FoodInvoice[]

  @@unique([classId, year, month])
}

model FoodInvoice {
  id           String     @id @default(cuid())
  studentId    String
  student      Student    @relation(fields: [studentId], references: [id])
  monthCloseId String
  monthClose   MonthClose @relation(fields: [monthCloseId], references: [id], onDelete: Cascade)
  year         Int
  month        Int
  daysPresent  Int
  rate         Int
  amount       Int
  createdAt    DateTime   @default(now())

  @@unique([studentId, year, month])
}

model Payment {
  id             String    @id @default(cuid())
  studentId      String
  student        Student   @relation(fields: [studentId], references: [id])
  kind           String
  amount         Int
  paidAt         DateTime
  note           String    @default("")
  registeredById String
  registeredBy   User      @relation(fields: [registeredById], references: [id])
  createdAt      DateTime  @default(now())
  deletedAt      DateTime?
  deleteReason   String?
}

model Expense {
  id           String     @id @default(cuid())
  classId      String
  class        Class      @relation(fields: [classId], references: [id])
  schoolYearId String
  schoolYear   SchoolYear @relation(fields: [schoolYearId], references: [id])
  date         DateTime
  title        String
  amount       Int
  note         String     @default("")
  createdById  String
  createdBy    User       @relation(fields: [createdById], references: [id])
  createdAt    DateTime   @default(now())
}
```

Create `.env`:

```
DATABASE_URL="file:./dev.db"
```

Add to `package.json` top level:

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

Run: `npx prisma db push && npx prisma generate`
Expected: `dev.db` created, client generated.

- [ ] **Step 2: Write db client and password helpers**

`src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

`src/lib/password.ts`:

```ts
import bcrypt from "bcryptjs";

const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 3: Write test DB setup and factories**

`tests/global-setup.ts`:

```ts
import { execSync } from "node:child_process";

export default async function () {
  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
```

`tests/setup.ts`:

```ts
import { beforeEach } from "vitest";
import { resetDb } from "./helpers/db";

beforeEach(async () => {
  await resetDb();
});
```

`tests/helpers/db.ts`:

```ts
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { dateOnly } from "@/lib/dates";
import type { Actor, Role } from "@/lib/roles";

export async function resetDb() {
  await prisma.$transaction([
    prisma.expense.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.foodInvoice.deleteMany(),
    prisma.monthClose.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.parentStudent.deleteMany(),
    prisma.student.deleteMany(),
    prisma.class.deleteMany(),
    prisma.holiday.deleteMany(),
    prisma.schoolYear.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

let seq = 0;
const next = () => ++seq;

export const PASSWORD = "secret123";

export const f = {
  async user(role: Role, o: Partial<{ name: string; email: string; password: string }> = {}) {
    const n = next();
    return prisma.user.create({
      data: {
        name: o.name ?? `${role.toLowerCase()} ${n}`,
        email: o.email ?? `${role.toLowerCase()}${n}@test.local`,
        passwordHash: await hashPassword(o.password ?? PASSWORD),
        role,
      },
    });
  },
  async schoolYear(o: Partial<{ name: string; isActive: boolean; startDate: Date; endDate: Date }> = {}) {
    const n = next();
    return prisma.schoolYear.create({
      data: {
        name: o.name ?? `Year ${n}`,
        startDate: o.startDate ?? dateOnly(2026, 9, 1),
        endDate: o.endDate ?? dateOnly(2027, 6, 1),
        isActive: o.isActive ?? true,
      },
    });
  },
  async klass(o: Partial<{ name: string; schoolYearId: string; teacherId: string | null; dailyFoodRate: number; annualFundAmount: number }> = {}) {
    const n = next();
    const schoolYearId = o.schoolYearId ?? (await f.schoolYear()).id;
    return prisma.class.create({
      data: {
        name: o.name ?? `Class ${n}`,
        schoolYearId,
        teacherId: o.teacherId ?? null,
        dailyFoodRate: o.dailyFoodRate ?? 3000,
        annualFundAmount: o.annualFundAmount ?? 50000,
      },
    });
  },
  async student(classId: string, o: Partial<{ name: string; isActive: boolean }> = {}) {
    const n = next();
    return prisma.student.create({ data: { classId, name: o.name ?? `Student ${n}`, isActive: o.isActive ?? true } });
  },
  async link(parentUserId: string, studentId: string) {
    return prisma.parentStudent.create({ data: { parentUserId, studentId } });
  },
  async holiday(schoolYearId: string, date: Date, name = "Holiday") {
    return prisma.holiday.create({ data: { schoolYearId, date, name } });
  },
};

export const actorOf = (u: { id: string; role: string }): Actor => ({ userId: u.id, role: u.role as Role });
```

- [ ] **Step 4: Write a failing smoke test for the DB layer**

`tests/services/db.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { f } from "../helpers/db";
import { verifyPassword } from "@/lib/password";

describe("db + factories", () => {
  it("creates a user with a verifiable password hash", async () => {
    const u = await f.user("ADMIN", { password: "pw" });
    expect(await verifyPassword("pw", u.passwordHash)).toBe(true);
    expect(await verifyPassword("nope", u.passwordHash)).toBe(false);
  });
  it("resets between tests", async () => {
    expect(await prisma.user.count()).toBe(0);
  });
  it("enforces unique attendance per student per day", async () => {
    const c = await f.klass();
    const s = await f.student(c.id);
    const d = new Date("2026-10-05T00:00:00Z");
    await prisma.attendance.create({ data: { studentId: s.id, date: d, status: "PRESENT" } });
    await expect(prisma.attendance.create({ data: { studentId: s.id, date: d, status: "ABSENT" } })).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS (the global setup pushes the schema to `test.db` first).

- [ ] **Step 6: Write the seed**

`prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@school.local" },
    update: {},
    create: { name: "Админ", email: "admin@school.local", passwordHash: await hash("changeme"), role: "ADMIN" },
  });
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@school.local" },
    update: {},
    create: { name: "Багш Болд", email: "teacher@school.local", passwordHash: await hash("changeme"), role: "TEACHER" },
  });
  await prisma.user.upsert({
    where: { email: "accountant@school.local" },
    update: {},
    create: { name: "Нягтлан Сараа", email: "accountant@school.local", passwordHash: await hash("changeme"), role: "ACCOUNTANT" },
  });
  const parent = await prisma.user.upsert({
    where: { email: "parent@school.local" },
    update: {},
    create: { name: "Эцэг эх Дорж", email: "parent@school.local", passwordHash: await hash("changeme"), role: "PARENT" },
  });
  const year = await prisma.schoolYear.upsert({
    where: { name: "2026-2027" },
    update: {},
    create: { name: "2026-2027", startDate: utc(2026, 9, 1), endDate: utc(2027, 6, 1), isActive: true },
  });
  const klass = await prisma.class.upsert({
    where: { schoolYearId_name: { schoolYearId: year.id, name: "1А" } },
    update: {},
    create: { name: "1А", schoolYearId: year.id, teacherId: teacher.id, dailyFoodRate: 3000, annualFundAmount: 50000 },
  });
  const existing = await prisma.student.count({ where: { classId: klass.id } });
  if (existing === 0) {
    const s1 = await prisma.student.create({ data: { classId: klass.id, name: "Батбаяр" } });
    await prisma.student.create({ data: { classId: klass.id, name: "Сарнай" } });
    await prisma.parentStudent.create({ data: { parentUserId: parent.id, studentId: s1.id } });
  }
  console.log("Seeded. Login: admin@school.local / changeme (also teacher@, accountant@, parent@)");
  void admin;
}

main().finally(() => prisma.$disconnect());
```

Run: `npm run db:seed`
Expected: prints the "Seeded." line.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: prisma schema, db client, password hashing, seed and test factories"
```

---

### Task 3: Login, sessions, action plumbing and shell UI

**Files:**
- Create: `src/services/auth.ts`, `src/lib/session.ts`, `src/lib/page-auth.ts`, `src/lib/action.ts`, `src/actions/auth.ts`, `src/components/ActionForm.tsx`, `src/components/Nav.tsx`, `src/components/Money.tsx`, `src/app/login/page.tsx`, `src/app/forbidden/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`
- Test: `tests/services/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `verifyPassword`, `AppError`, `mn`.
- Produces:
  - `authenticate(email: string, password: string): Promise<{ id: string; role: Role }>` throws `AppError("INVALID_CREDENTIALS")`.
  - `createSession(userId)`, `getActor(): Promise<Actor | null>`, `destroySession()`.
  - `requirePage(...roles: Role[]): Promise<Actor>` (redirects).
  - `type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }`
  - `runAction(fd: FormData, fn: (actor: Actor, data: Record<string,string>) => Promise<string | void>): Promise<ActionResult>`
  - `<ActionForm action submitLabel>` client component using `useActionState`.
  - `homeFor(role: Role): string` path.

- [ ] **Step 1: Write failing auth service test**

`tests/services/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { authenticate } from "@/services/auth";
import { f } from "../helpers/db";

describe("authenticate", () => {
  it("returns id and role for correct credentials", async () => {
    const u = await f.user("TEACHER", { email: "t@x.mn", password: "pw1234" });
    const r = await authenticate("t@x.mn", "pw1234");
    expect(r).toEqual({ id: u.id, role: "TEACHER" });
  });
  it("normalizes email case and whitespace", async () => {
    await f.user("PARENT", { email: "parent@x.mn", password: "pw1234" });
    const r = await authenticate("  Parent@X.MN ", "pw1234");
    expect(r.role).toBe("PARENT");
  });
  it("rejects wrong password and unknown email with the same error", async () => {
    await f.user("PARENT", { email: "p@x.mn", password: "pw1234" });
    await expect(authenticate("p@x.mn", "bad")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(authenticate("nobody@x.mn", "pw1234")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/auth.test.ts`
Expected: FAIL, cannot resolve `@/services/auth`.

- [ ] **Step 3: Implement auth service**

`src/services/auth.ts`:

```ts
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Role } from "@/lib/roles";

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export async function authenticate(email: string, password: string): Promise<{ id: string; role: Role }> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", mn.errors.invalidCredentials);
  }
  return { id: user.id, role: user.role as Role };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Session, page auth, action plumbing**

`src/lib/session.ts`:

```ts
import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Actor, Role } from "@/lib/roles";

const COOKIE = "sf_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string): Promise<void> {
  const id = randomBytes(32).toString("hex");
  await prisma.session.create({ data: { id, userId, expiresAt: new Date(Date.now() + TTL_MS) } });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function getActor(): Promise<Actor | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const s = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return { userId: s.userId, role: s.user.role as Role };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await prisma.session.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}
```

`src/lib/page-auth.ts`:

```ts
import "server-only";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import type { Actor, Role } from "@/lib/roles";

export function homeFor(role: Role): string {
  return { ADMIN: "/admin", TEACHER: "/teacher", ACCOUNTANT: "/accountant", PARENT: "/parent" }[role];
}

export async function requirePage(...roles: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (roles.length && !roles.includes(actor.role)) redirect("/forbidden");
  return actor;
}
```

`src/lib/action.ts`:

```ts
import "server-only";
import { getActor } from "@/lib/session";
import { AppError, ValidationError } from "@/lib/errors";
import { formToObject } from "@/lib/validate";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runAction(
  fd: FormData,
  fn: (actor: Actor, data: Record<string, string>) => Promise<string | void>,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: mn.errors.loginRequired };
  try {
    const message = await fn(actor, formToObject(fd));
    return message ? { ok: true, message } : { ok: true };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
}
```

`src/actions/auth.ts`:

```ts
"use server";
import { redirect } from "next/navigation";
import { authenticate } from "@/services/auth";
import { createSession, destroySession } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { ActionResult } from "@/lib/action";
import type { Role } from "@/lib/roles";

export async function loginAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  let role: Role | null = null;
  try {
    const u = await authenticate(email, password);
    await createSession(u.id);
    role = u.role;
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
  if (!role) return { ok: false, error: mn.errors.invalidCredentials };
  redirect(homeFor(role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
```

- [ ] **Step 6: Shared components**

`src/components/ActionForm.tsx`:

```tsx
"use client";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/action";

type Props = {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
};

export function ActionForm({ action, submitLabel, children, className, confirm }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className ?? "flex flex-col gap-2"}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && !state.ok && (
        <div className="text-sm text-red-700">
          <p>{state.error}</p>
          {state.fieldErrors &&
            Object.entries(state.fieldErrors).map(([k, msgs]) => (
              <p key={k}>
                {k}: {msgs.join(", ")}
              </p>
            ))}
        </div>
      )}
      {state?.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
      <button disabled={pending} className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50">
        {submitLabel}
      </button>
    </form>
  );
}
```

`src/components/Money.tsx`:

```tsx
import { formatMNT } from "@/lib/money";
export function Money({ v }: { v: number }) {
  return <span className={v < 0 ? "text-red-700" : ""}>{formatMNT(v)}</span>;
}
```

`src/components/Nav.tsx`:

```tsx
import Link from "next/link";
import { mn } from "@/lib/i18n/mn";
import { logoutAction } from "@/actions/auth";
import type { Role } from "@/lib/roles";

const links: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/admin", label: mn.nav.admin },
    { href: "/admin/classes", label: mn.nav.classes },
    { href: "/admin/users", label: mn.nav.users },
    { href: "/admin/school-years", label: mn.nav.schoolYears },
    { href: "/admin/holidays", label: mn.nav.holidays },
  ],
  TEACHER: [{ href: "/teacher", label: mn.nav.attendance }],
  ACCOUNTANT: [
    { href: "/accountant", label: mn.nav.outstanding },
    { href: "/accountant/payments", label: mn.nav.payments },
    { href: "/accountant/report", label: mn.nav.foodReport },
  ],
  PARENT: [{ href: "/parent", label: mn.nav.myChildren }],
};

export function Nav({ role }: { role: Role }) {
  return (
    <nav className="flex items-center gap-4 border-b bg-white px-4 py-2 text-sm">
      <span className="font-semibold">{mn.app}</span>
      {links[role].map((l) => (
        <Link key={l.href} href={l.href} className="hover:underline">
          {l.label}
        </Link>
      ))}
      <span className="ml-auto text-gray-500">{mn.roles[role]}</span>
      <form action={logoutAction}>
        <button className="underline">{mn.nav.logout}</button>
      </form>
    </nav>
  );
}
```

- [ ] **Step 7: Pages**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";

export default async function Home() {
  const actor = await getActor();
  redirect(actor ? homeFor(actor.role) : "/login");
}
```

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { mn } from "@/lib/i18n/mn";

export const metadata: Metadata = { title: mn.app };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
```

`src/app/login/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";
import { loginAction } from "@/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homeFor(actor.role));
  return (
    <main className="mx-auto mt-24 max-w-sm rounded border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">{mn.login.title}</h1>
      <ActionForm action={loginAction} submitLabel={mn.login.submit}>
        <label className="flex flex-col text-sm">
          {mn.login.email}
          <input name="email" type="email" required className="rounded border p-1" />
        </label>
        <label className="flex flex-col text-sm">
          {mn.login.password}
          <input name="password" type="password" required className="rounded border p-1" />
        </label>
      </ActionForm>
    </main>
  );
}
```

`src/app/forbidden/page.tsx`:

```tsx
import Link from "next/link";
import { mn } from "@/lib/i18n/mn";
export default function Forbidden() {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">{mn.errors.forbidden}</h1>
      <Link href="/" className="underline">{mn.app}</Link>
    </main>
  );
}
```

Role layouts (create all four now; each role's pages come in later tasks). `src/app/admin/layout.tsx`:

```tsx
import { requirePage } from "@/lib/page-auth";
import { Nav } from "@/components/Nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePage("ADMIN");
  return (
    <>
      <Nav role="ADMIN" />
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </>
  );
}
```

Create `src/app/teacher/layout.tsx`, `src/app/accountant/layout.tsx`, `src/app/parent/layout.tsx` identically with `"TEACHER"`, `"ACCOUNTANT"`, `"PARENT"`. Create a placeholder `page.tsx` in each role folder returning `<p>…</p>` so the app builds (replaced in later tasks).

- [ ] **Step 8: Manual check**

Run: `npm run db:seed && npm run dev`, open http://localhost:3000, log in as `admin@school.local` / `changeme`.
Expected: redirected to `/admin` with the nav bar; wrong password shows the Mongolian error; logout returns to `/login`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: email/password login with db sessions, role layouts and action plumbing"
```

---

### Task 4: Authorization helpers

**Files:**
- Create: `src/lib/authz.ts`
- Test: `tests/services/authz.test.ts`

**Interfaces:**
- Produces:
  - `requireRole(actor: Actor, ...roles: Role[]): void` throws `ForbiddenError`.
  - `assertClassAccess(actor: Actor, classId: string): Promise<void>` — ADMIN, ACCOUNTANT: ok; TEACHER: class.teacherId === actor.userId; PARENT: has a linked student in that class. Throws `NotFoundError` if class missing, else `ForbiddenError`.
  - `assertStudentAccess(actor: Actor, studentId: string): Promise<{ id: string; classId: string }>` — ADMIN, ACCOUNTANT: ok; TEACHER: student's class is theirs; PARENT: linked.

- [ ] **Step 1: Failing tests**

`tests/services/authz.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { requireRole, assertClassAccess, assertStudentAccess } from "@/lib/authz";
import { f, actorOf } from "../helpers/db";

describe("requireRole", () => {
  it("passes for allowed role and throws for others", () => {
    expect(() => requireRole({ userId: "x", role: "ADMIN" }, "ADMIN", "TEACHER")).not.toThrow();
    expect(() => requireRole({ userId: "x", role: "PARENT" }, "ADMIN")).toThrow(/Хандах эрхгүй/);
  });
});

describe("class and student access", () => {
  it("teacher can access own class only", async () => {
    const t = await f.user("TEACHER");
    const mine = await f.klass({ teacherId: t.id });
    const other = await f.klass();
    await expect(assertClassAccess(actorOf(t), mine.id)).resolves.toBeUndefined();
    await expect(assertClassAccess(actorOf(t), other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("admin and accountant can access any class", async () => {
    const c = await f.klass();
    for (const role of ["ADMIN", "ACCOUNTANT"] as const) {
      const u = await f.user(role);
      await expect(assertClassAccess(actorOf(u), c.id)).resolves.toBeUndefined();
    }
  });
  it("parent with children in two classes can read both, not a third", async () => {
    const p = await f.user("PARENT");
    const c1 = await f.klass();
    const c2 = await f.klass();
    const c3 = await f.klass();
    const s1 = await f.student(c1.id);
    const s2 = await f.student(c2.id);
    const s3 = await f.student(c3.id);
    await f.link(p.id, s1.id);
    await f.link(p.id, s2.id);
    await expect(assertClassAccess(actorOf(p), c1.id)).resolves.toBeUndefined();
    await expect(assertClassAccess(actorOf(p), c2.id)).resolves.toBeUndefined();
    await expect(assertClassAccess(actorOf(p), c3.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertStudentAccess(actorOf(p), s1.id)).resolves.toMatchObject({ classId: c1.id });
    await expect(assertStudentAccess(actorOf(p), s3.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("missing class or student is NOT_FOUND", async () => {
    const a = await f.user("ADMIN");
    await expect(assertClassAccess(actorOf(a), "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assertStudentAccess(actorOf(a), "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/authz.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/lib/authz.ts`:

```ts
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor, Role } from "@/lib/roles";

export function requireRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw new ForbiddenError();
}

export async function assertClassAccess(actor: Actor, classId: string): Promise<void> {
  const klass = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, teacherId: true } });
  if (!klass) throw new NotFoundError();
  if (actor.role === "ADMIN" || actor.role === "ACCOUNTANT") return;
  if (actor.role === "TEACHER") {
    if (klass.teacherId === actor.userId) return;
    throw new ForbiddenError();
  }
  const link = await prisma.parentStudent.findFirst({
    where: { parentUserId: actor.userId, student: { classId } },
  });
  if (!link) throw new ForbiddenError();
}

export async function assertStudentAccess(actor: Actor, studentId: string): Promise<{ id: string; classId: string }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, classId: true, class: { select: { teacherId: true } } },
  });
  if (!student) throw new NotFoundError();
  if (actor.role === "ADMIN" || actor.role === "ACCOUNTANT") return { id: student.id, classId: student.classId };
  if (actor.role === "TEACHER") {
    if (student.class.teacherId === actor.userId) return { id: student.id, classId: student.classId };
    throw new ForbiddenError();
  }
  const link = await prisma.parentStudent.findUnique({
    where: { parentUserId_studentId: { parentUserId: actor.userId, studentId } },
  });
  if (!link) throw new ForbiddenError();
  return { id: student.id, classId: student.classId };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/authz.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: role and class/student access checks"
```

---

### Task 5: School years and holidays (admin)

**Files:**
- Create: `src/services/school-years.ts`, `src/services/holidays.ts`, `src/actions/school-years.ts`, `src/actions/holidays.ts`, `src/app/admin/school-years/page.tsx`, `src/app/admin/holidays/page.tsx`
- Test: `tests/services/school-years.test.ts`, `tests/services/holidays.test.ts`

**Interfaces:**
- Produces:
  - `createSchoolYear(actor, input: { name; startDate; endDate }): Promise<SchoolYear>` (strings in, validated).
  - `activateSchoolYear(actor, id): Promise<void>` — sets this active, all others inactive, in one transaction.
  - `listSchoolYears(): Promise<SchoolYear[]>` ordered by startDate desc.
  - `getActiveSchoolYear(): Promise<SchoolYear>` throws `AppError("NO_ACTIVE_YEAR")`.
  - `addHoliday(actor, input: { schoolYearId; date; name }): Promise<Holiday>` — date must be inside the year.
  - `deleteHoliday(actor, id): Promise<void>`.
  - `listHolidays(schoolYearId): Promise<Holiday[]>`.
  - `holidayDates(schoolYearId): Promise<Date[]>`.

- [ ] **Step 1: Failing tests**

`tests/services/school-years.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createSchoolYear, activateSchoolYear, listSchoolYears, getActiveSchoolYear } from "@/services/school-years";
import { f, actorOf } from "../helpers/db";

describe("school years", () => {
  it("admin creates; others forbidden", async () => {
    const admin = await f.user("ADMIN");
    const y = await createSchoolYear(actorOf(admin), { name: "2026-2027", startDate: "2026-09-01", endDate: "2027-06-01" });
    expect(y.isActive).toBe(false);
    const t = await f.user("TEACHER");
    await expect(createSchoolYear(actorOf(t), { name: "x", startDate: "2026-09-01", endDate: "2027-06-01" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects end before start and bad dates", async () => {
    const admin = await f.user("ADMIN");
    await expect(createSchoolYear(actorOf(admin), { name: "x", startDate: "2027-09-01", endDate: "2026-06-01" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createSchoolYear(actorOf(admin), { name: "x", startDate: "bad", endDate: "2026-06-01" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("activating one deactivates the others", async () => {
    const admin = await f.user("ADMIN");
    const a = await f.schoolYear({ isActive: true });
    const b = await f.schoolYear({ isActive: false });
    await activateSchoolYear(actorOf(admin), b.id);
    const list = await listSchoolYears();
    expect(list.find((y) => y.id === a.id)?.isActive).toBe(false);
    expect(list.find((y) => y.id === b.id)?.isActive).toBe(true);
    expect((await getActiveSchoolYear()).id).toBe(b.id);
  });
  it("getActiveSchoolYear throws when none", async () => {
    await expect(getActiveSchoolYear()).rejects.toMatchObject({ code: "NO_ACTIVE_YEAR" });
  });
});
```

`tests/services/holidays.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addHoliday, deleteHoliday, listHolidays, holidayDates } from "@/services/holidays";
import { toISODate } from "@/lib/dates";
import { f, actorOf } from "../helpers/db";

describe("holidays", () => {
  it("admin adds within the year; outside rejected; duplicate rejected", async () => {
    const admin = await f.user("ADMIN");
    const y = await f.schoolYear();
    const h = await addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2026-11-26", name: "Тусгаар тогтнолын өдөр" });
    expect(toISODate(h.date)).toBe("2026-11-26");
    await expect(addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2025-01-01", name: "x" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2026-11-26", name: "dup" })).rejects.toThrow();
  });
  it("lists, exposes dates, deletes; teacher forbidden to add", async () => {
    const admin = await f.user("ADMIN");
    const y = await f.schoolYear();
    const h = await addHoliday(actorOf(admin), { schoolYearId: y.id, date: "2026-12-31", name: "x" });
    expect((await listHolidays(y.id)).map((x) => x.id)).toEqual([h.id]);
    expect((await holidayDates(y.id)).map(toISODate)).toEqual(["2026-12-31"]);
    const t = await f.user("TEACHER");
    await expect(addHoliday(actorOf(t), { schoolYearId: y.id, date: "2026-12-30", name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteHoliday(actorOf(admin), h.id);
    expect(await listHolidays(y.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/school-years.test.ts tests/services/holidays.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement services**

`src/services/school-years.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { parseDateOnly } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export const dateStringSchema = z.string().refine(
  (s) => {
    try {
      parseDateOnly(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: mn.errors.invalidDate },
);

const schoolYearSchema = z
  .object({
    name: z.string().trim().min(1, mn.errors.required),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine((v) => parseDateOnly(v.startDate) < parseDateOnly(v.endDate), {
    message: mn.errors.invalidDate,
    path: ["endDate"],
  });

export async function createSchoolYear(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(schoolYearSchema, input);
  return prisma.schoolYear.create({
    data: { name: v.name, startDate: parseDateOnly(v.startDate), endDate: parseDateOnly(v.endDate) },
  });
}

export async function activateSchoolYear(actor: Actor, id: string): Promise<void> {
  requireRole(actor, "ADMIN");
  await prisma.$transaction([
    prisma.schoolYear.updateMany({ data: { isActive: false } }),
    prisma.schoolYear.update({ where: { id }, data: { isActive: true } }),
  ]);
}

export function listSchoolYears() {
  return prisma.schoolYear.findMany({ orderBy: { startDate: "desc" } });
}

export async function getActiveSchoolYear() {
  const y = await prisma.schoolYear.findFirst({ where: { isActive: true } });
  if (!y) throw new AppError("NO_ACTIVE_YEAR", mn.errors.noActiveYear);
  return y;
}
```

`src/services/holidays.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { parseDateOnly } from "@/lib/dates";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { dateStringSchema } from "@/services/school-years";
import type { Actor } from "@/lib/roles";

const holidaySchema = z.object({
  schoolYearId: z.string().min(1),
  date: dateStringSchema,
  name: z.string().trim().min(1, mn.errors.required),
});

export async function addHoliday(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(holidaySchema, input);
  const year = await prisma.schoolYear.findUnique({ where: { id: v.schoolYearId } });
  if (!year) throw new NotFoundError();
  const date = parseDateOnly(v.date);
  if (date < year.startDate || date > year.endDate) {
    throw new ValidationError({ date: [mn.errors.dateOutsideYear] });
  }
  return prisma.holiday.create({ data: { schoolYearId: v.schoolYearId, date, name: v.name } });
}

export async function deleteHoliday(actor: Actor, id: string): Promise<void> {
  requireRole(actor, "ADMIN");
  await prisma.holiday.delete({ where: { id } });
}

export function listHolidays(schoolYearId: string) {
  return prisma.holiday.findMany({ where: { schoolYearId }, orderBy: { date: "asc" } });
}

export async function holidayDates(schoolYearId: string): Promise<Date[]> {
  const rows = await prisma.holiday.findMany({ where: { schoolYearId }, select: { date: true } });
  return rows.map((r) => r.date);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/school-years.test.ts tests/services/holidays.test.ts`
Expected: PASS.

- [ ] **Step 5: Actions and pages**

`src/actions/school-years.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createSchoolYear, activateSchoolYear } from "@/services/school-years";

export async function createSchoolYearAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createSchoolYear(actor, d);
    revalidatePath("/admin/school-years");
  });
}

export async function activateSchoolYearAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await activateSchoolYear(actor, d.id);
    revalidatePath("/admin", "layout");
  });
}
```

`src/actions/holidays.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { addHoliday, deleteHoliday } from "@/services/holidays";

export async function addHolidayAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await addHoliday(actor, d);
    revalidatePath("/admin/holidays");
  });
}

export async function deleteHolidayAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deleteHoliday(actor, d.id);
    revalidatePath("/admin/holidays");
  });
}
```

`src/app/admin/school-years/page.tsx`:

```tsx
import { listSchoolYears } from "@/services/school-years";
import { createSchoolYearAction, activateSchoolYearAction } from "@/actions/school-years";
import { ActionForm } from "@/components/ActionForm";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  const years = await listSchoolYears();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.schoolYear.title}</h1>
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.name}</th><th>{mn.schoolYear.startDate}</th><th>{mn.schoolYear.endDate}</th><th>{mn.common.status}</th><th /></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.id} className="border-t">
                <td className="p-2">{y.name}</td>
                <td className="text-center">{toISODate(y.startDate)}</td>
                <td className="text-center">{toISODate(y.endDate)}</td>
                <td className="text-center">{y.isActive ? mn.common.active : mn.common.inactive}</td>
                <td className="p-1">
                  {!y.isActive && (
                    <ActionForm action={activateSchoolYearAction} submitLabel={mn.common.activate} className="inline">
                      <input type="hidden" name="id" value={y.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.schoolYear.create}</h2>
        <ActionForm action={createSchoolYearAction} submitLabel={mn.common.add}>
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" placeholder="2026-2027" /></label>
          <label className="text-sm">{mn.schoolYear.startDate}<input name="startDate" type="date" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.schoolYear.endDate}<input name="endDate" type="date" required className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
    </div>
  );
}
```

`src/app/admin/holidays/page.tsx`:

```tsx
import { listSchoolYears } from "@/services/school-years";
import { listHolidays } from "@/services/holidays";
import { addHolidayAction, deleteHolidayAction } from "@/actions/holidays";
import { ActionForm } from "@/components/ActionForm";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const years = await listSchoolYears();
  const year = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive) ?? years[0];
  if (!year) return <p>{mn.schoolYear.noActive}</p>;
  const holidays = await listHolidays(year.id);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.holiday.title}</h1>
        <form className="mb-2 text-sm">
          <select name="year" defaultValue={year.id} className="rounded border p-1">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>{" "}
          <button className="underline">OK</button>
        </form>
        <table className="w-full border bg-white text-sm">
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-t">
                <td className="p-2">{toISODate(h.date)}</td>
                <td className="p-2">{h.name}</td>
                <td className="p-1">
                  <ActionForm action={deleteHolidayAction} submitLabel={mn.common.delete} className="inline">
                    <input type="hidden" name="id" value={h.id} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.holiday.add}</h2>
        <ActionForm action={addHolidayAction} submitLabel={mn.common.add}>
          <input type="hidden" name="schoolYearId" value={year.id} />
          <label className="text-sm">{mn.common.date}<input name="date" type="date" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Manual check**

Run: `npm run dev`, log in as admin, open `/admin/school-years`: create a year, activate it; `/admin/holidays`: add a holiday inside the year, try one outside and see the Mongolian error.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: admin school years and holidays"
```

---

### Task 6: Classes and users (admin)

**Files:**
- Create: `src/services/classes.ts`, `src/services/users.ts`, `src/actions/classes.ts`, `src/actions/users.ts`, `src/app/admin/classes/page.tsx`, `src/app/admin/classes/[id]/page.tsx`, `src/app/admin/users/page.tsx`
- Test: `tests/services/classes.test.ts`, `tests/services/users.test.ts`

**Interfaces:**
- Produces:
  - `createClass(actor, input: { name; schoolYearId; dailyFoodRate; annualFundAmount }): Promise<Class>`
  - `updateClassRates(actor, classId, input: { dailyFoodRate; annualFundAmount }): Promise<Class>`
  - `assignTeacher(actor, classId, teacherId: string | null): Promise<void>` — user must have role TEACHER.
  - `listClasses(schoolYearId): Promise<(Class & { teacher: { name } | null; _count: { students } })[]>`
  - `getClass(classId): Promise<Class & { schoolYear }>` throws NotFound.
  - `getTeacherClass(teacherId): Promise<Class | null>` — the class in the active year.
  - `createUser(actor, input: { name; email; password; role }): Promise<User>` — ADMIN any role; TEACHER only PARENT (used by Task 7). Throws `AppError("EMAIL_TAKEN")`.
  - `resetPassword(actor, userId, password): Promise<void>` ADMIN only.
  - `listUsers(role?: Role): Promise<User[]>`

- [ ] **Step 1: Failing tests**

`tests/services/classes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createClass, updateClassRates, assignTeacher, listClasses, getTeacherClass } from "@/services/classes";
import { f, actorOf } from "../helpers/db";

describe("classes", () => {
  it("admin creates with integer rates; validation on bad money", async () => {
    const admin = await f.user("ADMIN");
    const y = await f.schoolYear();
    const c = await createClass(actorOf(admin), { name: "1А", schoolYearId: y.id, dailyFoodRate: "3000", annualFundAmount: "50000" });
    expect(c.dailyFoodRate).toBe(3000);
    await expect(createClass(actorOf(admin), { name: "1Б", schoolYearId: y.id, dailyFoodRate: "3.5", annualFundAmount: "1" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createClass(actorOf(admin), { name: "1А", schoolYearId: y.id, dailyFoodRate: "1", annualFundAmount: "1" })).rejects.toThrow(); // unique
  });
  it("assigns only teachers; teacher role forbidden to assign", async () => {
    const admin = await f.user("ADMIN");
    const c = await f.klass();
    const t = await f.user("TEACHER");
    const p = await f.user("PARENT");
    await assignTeacher(actorOf(admin), c.id, t.id);
    expect((await getTeacherClass(t.id))?.id).toBe(c.id);
    await expect(assignTeacher(actorOf(admin), c.id, p.id)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(assignTeacher(actorOf(t), c.id, t.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await assignTeacher(actorOf(admin), c.id, null);
    expect(await getTeacherClass(t.id)).toBeNull();
  });
  it("getTeacherClass only returns the class in the active year", async () => {
    const t = await f.user("TEACHER");
    const old = await f.schoolYear({ isActive: false });
    await f.klass({ teacherId: t.id, schoolYearId: old.id });
    expect(await getTeacherClass(t.id)).toBeNull();
    const cur = await f.schoolYear({ isActive: true });
    const c = await f.klass({ teacherId: t.id, schoolYearId: cur.id });
    expect((await getTeacherClass(t.id))?.id).toBe(c.id);
  });
  it("updates rates and lists with student count", async () => {
    const admin = await f.user("ADMIN");
    const c = await f.klass();
    await f.student(c.id);
    await updateClassRates(actorOf(admin), c.id, { dailyFoodRate: "3500", annualFundAmount: "60000" });
    const list = await listClasses(c.schoolYearId);
    expect(list[0].dailyFoodRate).toBe(3500);
    expect(list[0]._count.students).toBe(1);
  });
});
```

`tests/services/users.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createUser, resetPassword, listUsers } from "@/services/users";
import { authenticate } from "@/services/auth";
import { f, actorOf } from "../helpers/db";

describe("users", () => {
  it("admin creates any role; email normalized; duplicate rejected", async () => {
    const admin = await f.user("ADMIN");
    const u = await createUser(actorOf(admin), { name: "T", email: " New@X.mn ", password: "pw1234", role: "TEACHER" });
    expect(u.email).toBe("new@x.mn");
    await expect(createUser(actorOf(admin), { name: "T2", email: "new@x.mn", password: "pw1234", role: "TEACHER" })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });
  it("teacher may only create PARENT; accountant none", async () => {
    const t = await f.user("TEACHER");
    await expect(createUser(actorOf(t), { name: "P", email: "p@x.mn", password: "pw1234", role: "PARENT" })).resolves.toBeTruthy();
    await expect(createUser(actorOf(t), { name: "A", email: "a@x.mn", password: "pw1234", role: "ADMIN" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(createUser(actorOf(acc), { name: "P", email: "p2@x.mn", password: "pw1234", role: "PARENT" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects short password", async () => {
    const admin = await f.user("ADMIN");
    await expect(createUser(actorOf(admin), { name: "P", email: "p@x.mn", password: "123", role: "PARENT" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("admin resets password; new password works", async () => {
    const admin = await f.user("ADMIN");
    const u = await f.user("PARENT", { email: "p@x.mn", password: "old123" });
    await resetPassword(actorOf(admin), u.id, "new123");
    await expect(authenticate("p@x.mn", "new123")).resolves.toBeTruthy();
    await expect(authenticate("p@x.mn", "old123")).rejects.toBeTruthy();
    expect((await listUsers("PARENT")).map((x) => x.id)).toEqual([u.id]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/classes.test.ts tests/services/users.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement services**

`src/services/classes.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { moneySchema } from "@/lib/money";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

const ratesSchema = z.object({ dailyFoodRate: moneySchema, annualFundAmount: moneySchema });
const classSchema = ratesSchema.extend({
  name: z.string().trim().min(1, mn.errors.required),
  schoolYearId: z.string().min(1),
});

export async function createClass(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(classSchema, input);
  return prisma.class.create({ data: v });
}

export async function updateClassRates(actor: Actor, classId: string, input: unknown) {
  requireRole(actor, "ADMIN");
  const v = parse(ratesSchema, input);
  return prisma.class.update({ where: { id: classId }, data: v });
}

export async function assignTeacher(actor: Actor, classId: string, teacherId: string | null): Promise<void> {
  requireRole(actor, "ADMIN");
  if (teacherId) {
    const u = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!u || u.role !== "TEACHER") throw new ValidationError({ teacherId: [mn.errors.notTeacher] });
  }
  await prisma.class.update({ where: { id: classId }, data: { teacherId } });
}

export function listClasses(schoolYearId: string) {
  return prisma.class.findMany({
    where: { schoolYearId },
    orderBy: { name: "asc" },
    include: { teacher: { select: { name: true } }, _count: { select: { students: true } } },
  });
}

export async function getClass(classId: string) {
  const c = await prisma.class.findUnique({ where: { id: classId }, include: { schoolYear: true } });
  if (!c) throw new NotFoundError();
  return c;
}

export function getTeacherClass(teacherId: string) {
  return prisma.class.findFirst({ where: { teacherId, schoolYear: { isActive: true } } });
}
```

`src/services/users.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { hashPassword } from "@/lib/password";
import { AppError, ForbiddenError } from "@/lib/errors";
import { normalizeEmail } from "@/services/auth";
import { ROLES, type Actor, type Role } from "@/lib/roles";
import { mn } from "@/lib/i18n/mn";

export const passwordSchema = z.string().min(6);

const userSchema = z.object({
  name: z.string().trim().min(1, mn.errors.required),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  role: z.enum(ROLES),
});

export async function createUser(actor: Actor, input: unknown) {
  requireRole(actor, "ADMIN", "TEACHER");
  const v = parse(userSchema, input);
  if (actor.role === "TEACHER" && v.role !== "PARENT") throw new ForbiddenError();
  const email = normalizeEmail(v.email);
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError("EMAIL_TAKEN", mn.errors.emailTaken);
  return prisma.user.create({ data: { name: v.name, email, passwordHash: await hashPassword(v.password), role: v.role } });
}

export async function resetPassword(actor: Actor, userId: string, password: string): Promise<void> {
  requireRole(actor, "ADMIN");
  const pw = parse(passwordSchema, password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw) } });
}

export function listUsers(role?: Role) {
  return prisma.user.findMany({ where: role ? { role } : {}, orderBy: [{ role: "asc" }, { name: "asc" }] });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/classes.test.ts tests/services/users.test.ts`
Expected: PASS.

- [ ] **Step 5: Actions**

`src/actions/classes.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createClass, updateClassRates, assignTeacher } from "@/services/classes";

export async function createClassAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createClass(actor, d);
    revalidatePath("/admin/classes");
  });
}
export async function updateClassRatesAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await updateClassRates(actor, d.classId, d);
    revalidatePath(`/admin/classes/${d.classId}`);
  });
}
export async function assignTeacherAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await assignTeacher(actor, d.classId, d.teacherId || null);
    revalidatePath(`/admin/classes/${d.classId}`);
  });
}
```

`src/actions/users.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { createUser, resetPassword } from "@/services/users";

export async function createUserAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createUser(actor, d);
    revalidatePath("/admin/users");
  });
}
export async function resetPasswordAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await resetPassword(actor, d.userId, d.password);
    revalidatePath("/admin/users");
  });
}
```

- [ ] **Step 6: Pages**

`src/app/admin/classes/page.tsx`:

```tsx
import Link from "next/link";
import { listSchoolYears } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { createClassAction } from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const years = await listSchoolYears();
  const year = years.find((y) => y.id === sp.year) ?? years.find((y) => y.isActive) ?? years[0];
  if (!year) return <p>{mn.schoolYear.noActive}</p>;
  const classes = await listClasses(year.id);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.nav.classes} — {year.name}</h1>
        <form className="mb-2 text-sm">
          <select name="year" defaultValue={year.id} className="rounded border p-1">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>{" "}<button className="underline">OK</button>
        </form>
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.class}</th><th>{mn.common.teacher}</th><th>{mn.class.dailyFoodRate}</th><th>{mn.class.annualFundAmount}</th><th>{mn.nav.students}</th></tr></thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2"><Link href={`/admin/classes/${c.id}`} className="underline">{c.name}</Link></td>
                <td className="text-center">{c.teacher?.name ?? mn.class.noTeacher}</td>
                <td className="text-right"><Money v={c.dailyFoodRate} /></td>
                <td className="text-right"><Money v={c.annualFundAmount} /></td>
                <td className="text-center">{c._count.students}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.class.create}</h2>
        <ActionForm action={createClassAction} submitLabel={mn.common.add}>
          <input type="hidden" name="schoolYearId" value={year.id} />
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" placeholder="1А" /></label>
          <label className="text-sm">{mn.class.dailyFoodRate}<input name="dailyFoodRate" type="number" min={1} step={1} required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.class.annualFundAmount}<input name="annualFundAmount" type="number" min={1} step={1} required className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
    </div>
  );
}
```

`src/app/admin/classes/[id]/page.tsx`:

```tsx
import { getClass } from "@/services/classes";
import { listUsers } from "@/services/users";
import { updateClassRatesAction, assignTeacherAction } from "@/actions/classes";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getClass(id);
  const teachers = await listUsers("TEACHER");
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded border bg-white p-4">
        <h1 className="mb-2 text-xl font-semibold">{c.name} — {c.schoolYear.name}</h1>
        <ActionForm action={updateClassRatesAction} submitLabel={mn.common.save}>
          <input type="hidden" name="classId" value={c.id} />
          <label className="text-sm">{mn.class.dailyFoodRate}<input name="dailyFoodRate" type="number" min={1} step={1} defaultValue={c.dailyFoodRate} className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.class.annualFundAmount}<input name="annualFundAmount" type="number" min={1} step={1} defaultValue={c.annualFundAmount} className="w-full rounded border p-1" /></label>
        </ActionForm>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.class.assignTeacher}</h2>
        <ActionForm action={assignTeacherAction} submitLabel={mn.common.save}>
          <input type="hidden" name="classId" value={c.id} />
          <select name="teacherId" defaultValue={c.teacherId ?? ""} className="rounded border p-1">
            <option value="">{mn.class.noTeacher}</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
          </select>
        </ActionForm>
      </section>
    </div>
  );
}
```

`src/app/admin/users/page.tsx`:

```tsx
import { listUsers } from "@/services/users";
import { createUserAction, resetPasswordAction } from "@/actions/users";
import { ActionForm } from "@/components/ActionForm";
import { ROLES } from "@/lib/roles";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  const users = await listUsers();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-2 text-xl font-semibold">{mn.nav.users}</h1>
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.name}</th><th>{mn.common.email}</th><th>{mn.common.role}</th><th>{mn.user.resetPassword}</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.name}</td>
                <td>{u.email}</td>
                <td className="text-center">{mn.roles[u.role as keyof typeof mn.roles]}</td>
                <td className="p-1">
                  <ActionForm action={resetPasswordAction} submitLabel={mn.user.resetPassword} className="flex gap-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <input name="password" type="text" minLength={6} placeholder={mn.user.newPassword} className="w-32 rounded border p-1" />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.user.create}</h2>
        <ActionForm action={createUserAction} submitLabel={mn.common.add}>
          <label className="text-sm">{mn.common.name}<input name="name" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.email}<input name="email" type="email" required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.password}<input name="password" type="text" minLength={6} required className="w-full rounded border p-1" /></label>
          <label className="text-sm">{mn.common.role}
            <select name="role" className="w-full rounded border p-1">
              {ROLES.map((r) => <option key={r} value={r}>{mn.roles[r]}</option>)}
            </select>
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Manual check and commit**

Run `npm run dev`; as admin create a class, create a teacher, assign them, reset a password.

```bash
git add -A
git commit -m "feat: admin classes and users"
```

---

### Task 7: Students and parent linking (teacher)

**Files:**
- Create: `src/services/students.ts`, `src/actions/students.ts`, `src/app/teacher/page.tsx` (replace placeholder), `src/app/teacher/class/[id]/layout.tsx`, `src/app/teacher/class/[id]/students/page.tsx`
- Test: `tests/services/students.test.ts`

**Interfaces:**
- Consumes: `createUser` (Task 6), `assertClassAccess`, `assertStudentAccess`, `getTeacherClass`.
- Produces:
  - `addStudent(actor, input: { classId; name }): Promise<Student>` TEACHER (own class) or ADMIN.
  - `setStudentActive(actor, studentId, isActive: boolean): Promise<void>`
  - `deleteStudent(actor, studentId): Promise<void>` throws `AppError("STUDENT_HAS_RECORDS")` if any invoice or payment exists.
  - `linkParent(actor, input: { studentId; email }): Promise<void>` existing PARENT user by email; `ValidationError` if not found or not PARENT.
  - `createParentForStudent(actor, input: { studentId; name; email; password }): Promise<User>`
  - `listStudents(classId, includeInactive = false)` with `parents: { parent: { name, email } }[]`
  - `listChildren(parentUserId)` → students with `class: { id, name }`

- [ ] **Step 1: Failing tests**

`tests/services/students.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addStudent, setStudentActive, deleteStudent, linkParent, createParentForStudent, listStudents, listChildren } from "@/services/students";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

async function setup() {
  const t = await f.user("TEACHER");
  const c = await f.klass({ teacherId: t.id });
  return { t, c, actor: actorOf(t) };
}

describe("students", () => {
  it("teacher adds to own class; not to another; accountant forbidden", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    expect(s.isActive).toBe(true);
    const other = await f.klass();
    await expect(addStudent(actor, { classId: other.id, name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(addStudent(actorOf(acc), { classId: c.id, name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("delete blocked when records exist; deactivate works; list filters inactive", async () => {
    const { c, actor, t } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    await prisma.payment.create({ data: { studentId: s.id, kind: "ANNUAL_FUND", amount: 1000, paidAt: new Date(), registeredById: t.id } });
    await expect(deleteStudent(actor, s.id)).rejects.toMatchObject({ code: "STUDENT_HAS_RECORDS" });
    await setStudentActive(actor, s.id, false);
    expect(await listStudents(c.id)).toEqual([]);
    expect((await listStudents(c.id, true)).map((x) => x.id)).toEqual([s.id]);
  });
  it("delete allowed without records", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    await prisma.attendance.create({ data: { studentId: s.id, date: new Date("2026-10-05T00:00:00Z"), status: "PRESENT" } });
    await deleteStudent(actor, s.id);
    expect(await prisma.student.count()).toBe(0);
  });
  it("links existing parent by email ignoring case; rejects non-parent and unknown", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    const p = await f.user("PARENT", { email: "mom@x.mn" });
    await linkParent(actor, { studentId: s.id, email: " MOM@x.MN " });
    expect((await listChildren(p.id)).map((x) => x.id)).toEqual([s.id]);
    await linkParent(actor, { studentId: s.id, email: "mom@x.mn" }); // idempotent
    const other = await f.user("TEACHER", { email: "t2@x.mn" });
    await expect(linkParent(actor, { studentId: s.id, email: other.email })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(linkParent(actor, { studentId: s.id, email: "ghost@x.mn" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("creates a parent account and links it", async () => {
    const { c, actor } = await setup();
    const s = await addStudent(actor, { classId: c.id, name: "Бат" });
    const p = await createParentForStudent(actor, { studentId: s.id, name: "Ээж", email: "mom@x.mn", password: "pw1234" });
    expect(p.role).toBe("PARENT");
    const list = await listStudents(c.id);
    expect(list[0].parents[0].parent.email).toBe("mom@x.mn");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/students.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/services/students.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess, assertStudentAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { AppError, ValidationError } from "@/lib/errors";
import { createUser } from "@/services/users";
import { normalizeEmail } from "@/services/auth";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

const addSchema = z.object({ classId: z.string().min(1), name: z.string().trim().min(1, mn.errors.required) });

export async function addStudent(actor: Actor, input: unknown) {
  requireRole(actor, "TEACHER", "ADMIN");
  const v = parse(addSchema, input);
  await assertClassAccess(actor, v.classId);
  return prisma.student.create({ data: v });
}

export async function setStudentActive(actor: Actor, studentId: string, isActive: boolean): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  await assertStudentAccess(actor, studentId);
  await prisma.student.update({ where: { id: studentId }, data: { isActive } });
}

export async function deleteStudent(actor: Actor, studentId: string): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  await assertStudentAccess(actor, studentId);
  const [inv, pay] = await Promise.all([
    prisma.foodInvoice.count({ where: { studentId } }),
    prisma.payment.count({ where: { studentId } }),
  ]);
  if (inv > 0 || pay > 0) throw new AppError("STUDENT_HAS_RECORDS", mn.errors.studentHasRecords);
  await prisma.student.delete({ where: { id: studentId } });
}

const linkSchema = z.object({ studentId: z.string().min(1), email: z.string().trim().min(1) });

export async function linkParent(actor: Actor, input: unknown): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  const v = parse(linkSchema, input);
  await assertStudentAccess(actor, v.studentId);
  const parent = await prisma.user.findUnique({ where: { email: normalizeEmail(v.email) } });
  if (!parent || parent.role !== "PARENT") throw new ValidationError({ email: [mn.errors.notParent] });
  await prisma.parentStudent.upsert({
    where: { parentUserId_studentId: { parentUserId: parent.id, studentId: v.studentId } },
    update: {},
    create: { parentUserId: parent.id, studentId: v.studentId },
  });
}

const createParentSchema = z.object({
  studentId: z.string().min(1),
  name: z.string().trim().min(1, mn.errors.required),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

export async function createParentForStudent(actor: Actor, input: unknown) {
  requireRole(actor, "TEACHER", "ADMIN");
  const v = parse(createParentSchema, input);
  await assertStudentAccess(actor, v.studentId);
  const parent = await createUser(actor, { name: v.name, email: v.email, password: v.password, role: "PARENT" });
  await prisma.parentStudent.create({ data: { parentUserId: parent.id, studentId: v.studentId } });
  return parent;
}

export function listStudents(classId: string, includeInactive = false) {
  return prisma.student.findMany({
    where: { classId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { name: "asc" },
    include: { parents: { include: { parent: { select: { name: true, email: true } } } } },
  });
}

export function listChildren(parentUserId: string) {
  return prisma.student.findMany({
    where: { parents: { some: { parentUserId } } },
    orderBy: { name: "asc" },
    include: { class: { select: { id: true, name: true } } },
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/students.test.ts`
Expected: PASS.

- [ ] **Step 5: Actions**

`src/actions/students.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { addStudent, setStudentActive, deleteStudent, linkParent, createParentForStudent } from "@/services/students";
import { mn } from "@/lib/i18n/mn";

const page = (classId: string) => `/teacher/class/${classId}/students`;

export async function addStudentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await addStudent(actor, d);
    revalidatePath(page(d.classId));
  });
}
export async function setStudentActiveAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await setStudentActive(actor, d.studentId, d.isActive === "true");
    revalidatePath(page(d.classId));
  });
}
export async function deleteStudentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deleteStudent(actor, d.studentId);
    revalidatePath(page(d.classId));
  });
}
export async function linkParentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await linkParent(actor, d);
    revalidatePath(page(d.classId));
  });
}
export async function createParentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await createParentForStudent(actor, d);
    revalidatePath(page(d.classId));
    return `${mn.student.parentCreated} ${d.password}`;
  });
}
```

- [ ] **Step 6: Teacher entry page and class layout**

Replace `src/app/teacher/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { getTeacherClass } from "@/services/classes";
import { mn } from "@/lib/i18n/mn";

export default async function TeacherHome() {
  const actor = await requirePage("TEACHER");
  const c = await getTeacherClass(actor.userId);
  if (!c) return <p>{mn.class.noClass}</p>;
  redirect(`/teacher/class/${c.id}/attendance`);
}
```

`src/app/teacher/class/[id]/layout.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { assertClassAccess } from "@/lib/authz";
import { getClass } from "@/services/classes";
import { mn } from "@/lib/i18n/mn";

export default async function ClassLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requirePage("TEACHER");
  try {
    await assertClassAccess(actor, id);
  } catch {
    redirect("/forbidden");
  }
  const c = await getClass(id);
  const base = `/teacher/class/${id}`;
  const tabs = [
    [`${base}/attendance`, mn.nav.attendance],
    [`${base}/students`, mn.nav.students],
    [`${base}/expenses`, mn.nav.expenses],
    [`${base}/report`, mn.nav.report],
  ];
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{c.name} — {c.schoolYear.name}</h1>
      <div className="mb-4 flex gap-4 border-b text-sm">
        {tabs.map(([href, label]) => <Link key={href} href={href} className="pb-1 hover:underline">{label}</Link>)}
      </div>
      {children}
    </div>
  );
}
```

`src/app/teacher/class/[id]/students/page.tsx`:

```tsx
import { listStudents } from "@/services/students";
import { addStudentAction, setStudentActiveAction, deleteStudentAction, linkParentAction, createParentAction } from "@/actions/students";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ all?: string }> }) {
  const { id } = await params;
  const { all } = await searchParams;
  const students = await listStudents(id, all === "1");
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="md:col-span-2">
        <a href={all === "1" ? "?" : "?all=1"} className="text-sm underline">{mn.student.showInactive}</a>
        <table className="mt-2 w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.name}</th><th>{mn.student.parents}</th><th>{mn.common.status}</th><th>{mn.common.actions}</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t align-top">
                <td className="p-2">{s.name}</td>
                <td className="p-2">
                  {s.parents.map((p) => <div key={p.parent.email}>{p.parent.name} ({p.parent.email})</div>)}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-blue-700">{mn.student.linkParent}</summary>
                    <ActionForm action={linkParentAction} submitLabel={mn.common.save} className="flex gap-1">
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="studentId" value={s.id} />
                      <input name="email" type="email" required className="rounded border p-1" />
                    </ActionForm>
                  </details>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-blue-700">{mn.student.createParent}</summary>
                    <ActionForm action={createParentAction} submitLabel={mn.common.add}>
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="studentId" value={s.id} />
                      <input name="name" required placeholder={mn.common.name} className="rounded border p-1" />
                      <input name="email" type="email" required placeholder={mn.common.email} className="rounded border p-1" />
                      <input name="password" type="text" minLength={6} required placeholder={mn.common.tempPassword} className="rounded border p-1" />
                    </ActionForm>
                  </details>
                </td>
                <td className="p-2 text-center">{s.isActive ? mn.common.active : mn.common.inactive}</td>
                <td className="p-2">
                  <ActionForm action={setStudentActiveAction} submitLabel={s.isActive ? mn.common.deactivate : mn.common.activate} className="inline">
                    <input type="hidden" name="classId" value={id} />
                    <input type="hidden" name="studentId" value={s.id} />
                    <input type="hidden" name="isActive" value={String(!s.isActive)} />
                  </ActionForm>{" "}
                  <ActionForm action={deleteStudentAction} submitLabel={mn.common.delete} className="inline">
                    <input type="hidden" name="classId" value={id} />
                    <input type="hidden" name="studentId" value={s.id} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.student.add}</h2>
        <ActionForm action={addStudentAction} submitLabel={mn.common.add}>
          <input type="hidden" name="classId" value={id} />
          <input name="name" required placeholder={mn.common.name} className="rounded border p-1" />
        </ActionForm>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Manual check and commit**

Log in as `teacher@school.local`, add a student, create a parent for them, deactivate and reactivate.

```bash
git add -A
git commit -m "feat: teacher roster with parent account creation and linking"
```

---

### Task 8: Billing math (pure functions)

**Files:**
- Create: `src/lib/billing.ts`
- Test: `tests/unit/billing.test.ts`

**Interfaces:**
- Produces:
  - `chargeableDates(year, month, holidays: Date[]): Date[]` — weekdays of the month not in holidays.
  - `isChargeable(date: Date, holidays: Date[]): boolean`
  - `countPresentDays(rows: { date: Date; status: string }[], year, month, holidays: Date[]): number`
  - `invoiceAmount(daysPresent: number, rate: number): number`
  - `allocateFoodPayments<T extends { year: number; month: number; amount: number }>(invoices: T[], totalPaid: number): (T & { paid: number; outstanding: number })[]` sorted oldest first.
  - `foodOutstanding(invoiceTotal: number, paidTotal: number): number` = max(0, diff)
  - `foodCredit(invoiceTotal, paidTotal): number` = max(0, paid − invoices)
  - `fundBalance(collected: number, spent: number): number`

- [ ] **Step 1: Failing tests**

`tests/unit/billing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { chargeableDates, isChargeable, countPresentDays, invoiceAmount, allocateFoodPayments, foodOutstanding, foodCredit, fundBalance } from "@/lib/billing";
import { dateOnly, toISODate } from "@/lib/dates";

describe("chargeable days", () => {
  it("excludes weekends and holidays", () => {
    // Oct 2026: 31 days, 22 weekdays. Make Oct 5 (Mon) a holiday.
    const d = chargeableDates(2026, 10, [dateOnly(2026, 10, 5)]);
    expect(d).toHaveLength(21);
    expect(d.map(toISODate)).not.toContain("2026-10-05");
    expect(d.map(toISODate)).not.toContain("2026-10-03");
  });
  it("isChargeable", () => {
    expect(isChargeable(dateOnly(2026, 10, 5), [])).toBe(true);
    expect(isChargeable(dateOnly(2026, 10, 5), [dateOnly(2026, 10, 5)])).toBe(false);
    expect(isChargeable(dateOnly(2026, 10, 4), [])).toBe(false);
  });
});

describe("countPresentDays", () => {
  it("counts PRESENT on chargeable days only; unmarked is absent", () => {
    const rows = [
      { date: dateOnly(2026, 10, 1), status: "PRESENT" },
      { date: dateOnly(2026, 10, 2), status: "ABSENT" },
      { date: dateOnly(2026, 10, 3), status: "PRESENT" }, // Saturday, ignored
      { date: dateOnly(2026, 10, 5), status: "PRESENT" }, // holiday, ignored
      { date: dateOnly(2026, 11, 2), status: "PRESENT" }, // other month
    ];
    expect(countPresentDays(rows, 2026, 10, [dateOnly(2026, 10, 5)])).toBe(1);
    expect(countPresentDays([], 2026, 10, [])).toBe(0);
  });
});

describe("invoiceAmount", () => {
  it("multiplies", () => {
    expect(invoiceAmount(18, 3000)).toBe(54000);
    expect(invoiceAmount(0, 3000)).toBe(0);
  });
});

describe("allocateFoodPayments", () => {
  const inv = [
    { id: "b", year: 2026, month: 10, amount: 30000 },
    { id: "a", year: 2026, month: 9, amount: 45000 },
  ];
  it("applies oldest first, partial on the next", () => {
    const r = allocateFoodPayments(inv, 50000);
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r[0]).toMatchObject({ paid: 45000, outstanding: 0 });
    expect(r[1]).toMatchObject({ paid: 5000, outstanding: 25000 });
  });
  it("overpayment marks all paid and never goes negative", () => {
    const r = allocateFoodPayments(inv, 100000);
    expect(r.every((x) => x.outstanding === 0)).toBe(true);
    expect(r[1].paid).toBe(30000);
    expect(foodOutstanding(75000, 100000)).toBe(0);
    expect(foodCredit(75000, 100000)).toBe(25000);
    expect(foodCredit(75000, 50000)).toBe(0);
  });
  it("zero paid leaves everything outstanding", () => {
    const r = allocateFoodPayments(inv, 0);
    expect(r.map((x) => x.outstanding)).toEqual([45000, 30000]);
    expect(foodOutstanding(75000, 0)).toBe(75000);
  });
});

describe("fundBalance", () => {
  it("collected minus spent, may be negative", () => {
    expect(fundBalance(100000, 40000)).toBe(60000);
    expect(fundBalance(10000, 40000)).toBe(-30000);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/unit/billing.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/lib/billing.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npm test -- tests/unit/billing.test.ts`
Expected: PASS.

```bash
git add -A
git commit -m "feat: pure billing math for invoices, allocation and fund balance"
```

---

### Task 9: Attendance (teacher)

**Files:**
- Create: `src/services/attendance.ts`, `src/actions/attendance.ts`, `src/components/AttendanceGrid.tsx`, `src/app/teacher/class/[id]/attendance/page.tsx`
- Test: `tests/services/attendance.test.ts`

**Interfaces:**
- Consumes: `isChargeable`, `holidayDates`, `isFuture`, `assertStudentAccess`, `assertClassAccess`.
- Produces:
  - `toggleAttendance(actor, input: { studentId; date: string }, now?: Date): Promise<"PRESENT" | "ABSENT" | null>` cycles unmarked → PRESENT → ABSENT → unmarked. Errors: `FUTURE_DATE`, `MONTH_CLOSED`, `NON_CHARGEABLE_DAY`.
  - `markAllPresent(actor, input: { classId; date: string }, now?: Date): Promise<number>` sets PRESENT for all active students; same guards; returns count.
  - `getMonthAttendance(classId, year, month): Promise<{ studentId: string; date: Date; status: string }[]>`
  - `isMonthClosed(classId, year, month): Promise<boolean>` (lives here; Task 10 reuses it).

- [ ] **Step 1: Failing tests**

`tests/services/attendance.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toggleAttendance, markAllPresent, getMonthAttendance, isMonthClosed } from "@/services/attendance";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z"); // 2026-10-20 in UB

async function setup() {
  const t = await f.user("TEACHER");
  const y = await f.schoolYear();
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id });
  const s = await f.student(c.id);
  return { t, y, c, s, actor: actorOf(t) };
}

describe("toggleAttendance", () => {
  it("cycles unmarked -> PRESENT -> ABSENT -> unmarked", async () => {
    const { s, actor } = await setup();
    expect(await toggleAttendance(actor, { studentId: s.id, date: "2026-10-05" }, NOW)).toBe("PRESENT");
    expect(await toggleAttendance(actor, { studentId: s.id, date: "2026-10-05" }, NOW)).toBe("ABSENT");
    expect(await toggleAttendance(actor, { studentId: s.id, date: "2026-10-05" }, NOW)).toBeNull();
    expect(await prisma.attendance.count()).toBe(0);
  });
  it("rejects future dates, weekends, holidays", async () => {
    const { s, y, actor } = await setup();
    await f.holiday(y.id, new Date("2026-10-06T00:00:00Z"));
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-10-21" }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-10-04" }, NOW)).rejects.toMatchObject({ code: "NON_CHARGEABLE_DAY" });
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-10-06" }, NOW)).rejects.toMatchObject({ code: "NON_CHARGEABLE_DAY" });
  });
  it("rejects when month is closed", async () => {
    const { s, c, t, actor } = await setup();
    await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
    expect(await isMonthClosed(c.id, 2026, 9)).toBe(true);
    await expect(toggleAttendance(actor, { studentId: s.id, date: "2026-09-15" }, NOW)).rejects.toMatchObject({ code: "MONTH_CLOSED" });
  });
  it("other teacher, accountant and admin cannot mark", async () => {
    const { s } = await setup();
    const t2 = await f.user("TEACHER");
    await expect(toggleAttendance(actorOf(t2), { studentId: s.id, date: "2026-10-05" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(toggleAttendance(actorOf(acc), { studentId: s.id, date: "2026-10-05" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await f.user("ADMIN");
    await expect(toggleAttendance(actorOf(admin), { studentId: s.id, date: "2026-10-05" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("markAllPresent / getMonthAttendance", () => {
  it("marks active students only and reads back the month", async () => {
    const { c, s, actor } = await setup();
    await f.student(c.id, { isActive: false });
    const s3 = await f.student(c.id);
    expect(await markAllPresent(actor, { classId: c.id, date: "2026-10-20" }, NOW)).toBe(2);
    expect(await markAllPresent(actor, { classId: c.id, date: "2026-10-20" }, NOW)).toBe(2); // idempotent
    const rows = await getMonthAttendance(c.id, 2026, 10);
    expect(rows.map((r) => r.studentId).sort()).toEqual([s.id, s3.id].sort());
    expect(rows.every((r) => r.status === "PRESENT")).toBe(true);
    expect(await getMonthAttendance(c.id, 2026, 9)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/attendance.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/services/attendance.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertStudentAccess, assertClassAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { parseDateOnly, isFuture, monthRange } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { holidayDates } from "@/services/holidays";
import { dateStringSchema } from "@/services/school-years";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor, AttendanceStatus } from "@/lib/roles";

export async function isMonthClosed(classId: string, year: number, month: number): Promise<boolean> {
  return (await prisma.monthClose.count({ where: { classId, year, month } })) > 0;
}

async function guardDate(classId: string, schoolYearId: string, date: Date, now: Date): Promise<void> {
  if (isFuture(date, now)) throw new AppError("FUTURE_DATE", mn.errors.futureDate);
  if (!isChargeable(date, await holidayDates(schoolYearId))) throw new AppError("NON_CHARGEABLE_DAY", mn.errors.nonChargeableDay);
  if (await isMonthClosed(classId, date.getUTCFullYear(), date.getUTCMonth() + 1)) throw new AppError("MONTH_CLOSED", mn.errors.monthClosed);
}

const toggleSchema = z.object({ studentId: z.string().min(1), date: dateStringSchema });

export async function toggleAttendance(actor: Actor, input: unknown, now: Date = new Date()): Promise<AttendanceStatus | null> {
  requireRole(actor, "TEACHER");
  const v = parse(toggleSchema, input);
  const { classId } = await assertStudentAccess(actor, v.studentId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const date = parseDateOnly(v.date);
  await guardDate(classId, klass.schoolYearId, date, now);

  const existing = await prisma.attendance.findUnique({ where: { studentId_date: { studentId: v.studentId, date } } });
  if (!existing) {
    await prisma.attendance.create({ data: { studentId: v.studentId, date, status: "PRESENT" } });
    return "PRESENT";
  }
  if (existing.status === "PRESENT") {
    await prisma.attendance.update({ where: { id: existing.id }, data: { status: "ABSENT" } });
    return "ABSENT";
  }
  await prisma.attendance.delete({ where: { id: existing.id } });
  return null;
}

const allSchema = z.object({ classId: z.string().min(1), date: dateStringSchema });

export async function markAllPresent(actor: Actor, input: unknown, now: Date = new Date()): Promise<number> {
  requireRole(actor, "TEACHER");
  const v = parse(allSchema, input);
  await assertClassAccess(actor, v.classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  const date = parseDateOnly(v.date);
  await guardDate(v.classId, klass.schoolYearId, date, now);
  const students = await prisma.student.findMany({ where: { classId: v.classId, isActive: true }, select: { id: true } });
  await prisma.$transaction(
    students.map((s) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: s.id, date } },
        update: { status: "PRESENT" },
        create: { studentId: s.id, date, status: "PRESENT" },
      }),
    ),
  );
  return students.length;
}

export function getMonthAttendance(classId: string, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return prisma.attendance.findMany({
    where: { student: { classId }, date: { gte: start, lt: end } },
    select: { studentId: true, date: true, status: true },
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/attendance.test.ts`
Expected: PASS.

- [ ] **Step 5: Actions and grid**

`src/actions/attendance.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/session";
import { toggleAttendance, markAllPresent } from "@/services/attendance";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { runAction, type ActionResult } from "@/lib/action";

export type ToggleResult = { ok: true; status: "PRESENT" | "ABSENT" | null } | { ok: false; error: string };

export async function toggleAttendanceAction(studentId: string, date: string): Promise<ToggleResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: mn.errors.loginRequired };
  try {
    const status = await toggleAttendance(actor, { studentId, date });
    return { ok: true, status };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function markAllPresentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await markAllPresent(actor, d);
    revalidatePath(`/teacher/class/${d.classId}/attendance`);
  });
}
```

`src/components/AttendanceGrid.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { toggleAttendanceAction } from "@/actions/attendance";
import { mn } from "@/lib/i18n/mn";

export type GridStudent = { id: string; name: string };
export type GridDay = { iso: string; day: number; weekday: number; chargeable: boolean; future: boolean };
type Status = "PRESENT" | "ABSENT" | null;

export function AttendanceGrid({ students, days, initial, readOnly }: {
  students: GridStudent[];
  days: GridDay[];
  initial: Record<string, Status>; // key `${studentId}|${iso}`
  readOnly: boolean;
}) {
  const [cells, setCells] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const click = (studentId: string, iso: string) => {
    start(async () => {
      const r = await toggleAttendanceAction(studentId, iso);
      if (r.ok) {
        setError(null);
        setCells((c) => ({ ...c, [`${studentId}|${iso}`]: r.status }));
      } else setError(r.error);
    });
  };

  const label = (s: Status) => (s === "PRESENT" ? mn.attendance.presentShort : s === "ABSENT" ? mn.attendance.absentShort : "");
  const color = (s: Status) => (s === "PRESENT" ? "bg-green-200" : s === "ABSENT" ? "bg-red-200" : "bg-white");

  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <table className="border text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white p-1 text-left">{mn.common.student}</th>
            {days.map((d) => (
              <th key={d.iso} className={`w-7 p-0 text-center ${d.chargeable ? "" : "bg-gray-200 text-gray-400"}`}>
                {d.day}<br />{mn.weekdaysShort[d.weekday]}
              </th>
            ))}
            <th className="p-1">{mn.attendance.daysPresent}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const present = days.filter((d) => d.chargeable && cells[`${s.id}|${d.iso}`] === "PRESENT").length;
            return (
              <tr key={s.id} className="border-t">
                <td className="sticky left-0 bg-white p-1 whitespace-nowrap">{s.name}</td>
                {days.map((d) => {
                  const st = cells[`${s.id}|${d.iso}`] ?? null;
                  const disabled = readOnly || !d.chargeable || d.future;
                  return (
                    <td key={d.iso} className={`p-0 text-center ${d.chargeable ? color(st) : "bg-gray-200"}`}>
                      <button disabled={disabled} onClick={() => click(s.id, d.iso)} className="h-7 w-7 disabled:cursor-not-allowed">
                        {label(st)}
                      </button>
                    </td>
                  );
                })}
                <td className="p-1 text-center font-semibold">{present}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

`src/app/teacher/class/[id]/attendance/page.tsx` (the close/reopen controls are added in Task 10):

```tsx
import Link from "next/link";
import { getClass } from "@/services/classes";
import { listStudents } from "@/services/students";
import { getMonthAttendance, isMonthClosed } from "@/services/attendance";
import { holidayDates } from "@/services/holidays";
import { markAllPresentAction } from "@/actions/attendance";
import { ActionForm } from "@/components/ActionForm";
import { AttendanceGrid, type GridDay } from "@/components/AttendanceGrid";
import { monthDates, toISODate, todayDate, isFuture } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const today = todayDate();
  const year = Number(sp.year ?? today.getUTCFullYear());
  const month = Number(sp.month ?? today.getUTCMonth() + 1);
  const c = await getClass(id);
  const [students, rows, holidays, closed] = await Promise.all([
    listStudents(id),
    getMonthAttendance(id, year, month),
    holidayDates(c.schoolYearId),
    isMonthClosed(id, year, month),
  ]);
  const days: GridDay[] = monthDates(year, month).map((d) => ({
    iso: toISODate(d), day: d.getUTCDate(), weekday: d.getUTCDay(), chargeable: isChargeable(d, holidays), future: isFuture(d),
  }));
  const initial: Record<string, "PRESENT" | "ABSENT" | null> = {};
  for (const r of rows) initial[`${r.studentId}|${toISODate(r.date)}`] = r.status as "PRESENT" | "ABSENT";
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const todayIso = toISODate(today);
  const todayInMonth = todayIso.startsWith(`${year}-${String(month).padStart(2, "0")}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <Link href={`?year=${prev.y}&month=${prev.m}`} className="underline">←</Link>
        <span className="font-semibold">{year} {mn.months[month - 1]}</span>
        <Link href={`?year=${next.y}&month=${next.m}`} className="underline">→</Link>
        {closed && <span className="rounded bg-yellow-100 px-2">{mn.attendance.closed}</span>}
        {!closed && todayInMonth && (
          <ActionForm action={markAllPresentAction} submitLabel={mn.attendance.markAllPresentToday} className="inline">
            <input type="hidden" name="classId" value={id} />
            <input type="hidden" name="date" value={todayIso} />
          </ActionForm>
        )}
      </div>
      <AttendanceGrid students={students.map((s) => ({ id: s.id, name: s.name }))} days={days} initial={initial} readOnly={closed} />
    </div>
  );
}
```

- [ ] **Step 6: Manual check and commit**

As teacher, open attendance, click cells (cycle), confirm weekends are disabled, use "all present today".

```bash
git add -A
git commit -m "feat: teacher attendance grid with toggle and mark-all-present"
```

---

### Task 10: Close and reopen month

**Files:**
- Create: `src/services/month-close.ts`, `src/actions/month-close.ts`
- Modify: `src/app/teacher/class/[id]/attendance/page.tsx` (add close button), create `src/app/admin/classes/[id]/months/page.tsx` (reopen)
- Test: `tests/services/month-close.test.ts`

**Interfaces:**
- Consumes: `countPresentDays`, `invoiceAmount`, `holidayDates`, `getMonthAttendance`, `isMonthClosed`, `isFutureMonth`.
- Produces:
  - `closeMonth(actor, input: { classId; year; month }, now?: Date): Promise<{ invoices: number }>` TEACHER (own class). Errors `MONTH_ALREADY_CLOSED`, `FUTURE_MONTH`.
  - `reopenMonth(actor, input: { classId; year; month }): Promise<void>` ADMIN. Errors `MONTH_NOT_CLOSED`, `REOPEN_BLOCKED`.
  - `listMonthCloses(classId)` ordered by year, month.

- [ ] **Step 1: Failing tests**

`tests/services/month-close.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { closeMonth, reopenMonth, listMonthCloses } from "@/services/month-close";
import { prisma } from "@/lib/db";
import { dateOnly } from "@/lib/dates";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z");

async function setup() {
  const t = await f.user("TEACHER");
  const y = await f.schoolYear();
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id, dailyFoodRate: 3000 });
  const s1 = await f.student(c.id);
  const s2 = await f.student(c.id);
  return { t, y, c, s1, s2, actor: actorOf(t) };
}

async function present(studentId: string, ...days: number[]) {
  for (const d of days) await prisma.attendance.create({ data: { studentId, date: dateOnly(2026, 9, d), status: "PRESENT" } });
}

describe("closeMonth", () => {
  it("creates one invoice per active student using chargeable present days", async () => {
    const { c, s1, s2, y, actor } = await setup();
    await f.holiday(y.id, dateOnly(2026, 9, 7));
    await present(s1.id, 1, 2, 5, 7); // Sep 5 2026 is Saturday, Sep 7 holiday -> 2 days
    await present(s2.id, 1);
    const r = await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    expect(r.invoices).toBe(2);
    const inv = await prisma.foodInvoice.findMany({ orderBy: { amount: "desc" } });
    expect(inv.map((i) => [i.daysPresent, i.rate, i.amount])).toEqual([[2, 3000, 6000], [1, 3000, 3000]]);
    expect((await listMonthCloses(c.id)).map((m) => m.month)).toEqual([9]);
  });
  it("zero-day students still get a zero invoice; inactive students are skipped", async () => {
    const { c, s1, actor } = await setup();
    await prisma.student.update({ where: { id: s1.id }, data: { isActive: false } });
    const r = await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    expect(r.invoices).toBe(1);
    expect((await prisma.foodInvoice.findFirst())?.amount).toBe(0);
  });
  it("rejects already closed, future month, other teacher", async () => {
    const { c, actor } = await setup();
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    await expect(closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW)).rejects.toMatchObject({ code: "MONTH_ALREADY_CLOSED" });
    await expect(closeMonth(actor, { classId: c.id, year: "2026", month: "11" }, NOW)).rejects.toMatchObject({ code: "FUTURE_MONTH" });
    const t2 = await f.user("TEACHER");
    await expect(closeMonth(actorOf(t2), { classId: c.id, year: "2026", month: "10" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rate change after a close does not alter the old invoice", async () => {
    const { c, s1, actor } = await setup();
    await present(s1.id, 1);
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    await prisma.class.update({ where: { id: c.id }, data: { dailyFoodRate: 5000 } });
    await prisma.attendance.create({ data: { studentId: s1.id, date: dateOnly(2026, 10, 1), status: "PRESENT" } });
    await closeMonth(actor, { classId: c.id, year: "2026", month: "10" }, NOW);
    const inv = await prisma.foodInvoice.findMany({ where: { studentId: s1.id }, orderBy: { month: "asc" } });
    expect(inv.map((i) => i.amount)).toEqual([3000, 5000]);
  });
});

describe("reopenMonth", () => {
  it("admin reopens; invoices removed; attendance kept; blocked after a later payment", async () => {
    const { c, s1, actor, t } = await setup();
    const admin = await f.user("ADMIN");
    await present(s1.id, 1);
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    await expect(reopenMonth(actorOf(t), { classId: c.id, year: "2026", month: "9" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" });
    expect(await prisma.foodInvoice.count()).toBe(0);
    expect(await prisma.attendance.count()).toBe(1);
    await expect(reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" })).rejects.toMatchObject({ code: "MONTH_NOT_CLOSED" });

    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    const acc = await f.user("ACCOUNTANT");
    await prisma.payment.create({ data: { studentId: s1.id, kind: "FOOD", amount: 3000, paidAt: new Date(), registeredById: acc.id } });
    await expect(reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" })).rejects.toMatchObject({ code: "REOPEN_BLOCKED" });
  });
  it("a soft-deleted later payment does not block reopening", async () => {
    const { c, s1, actor } = await setup();
    const admin = await f.user("ADMIN");
    await closeMonth(actor, { classId: c.id, year: "2026", month: "9" }, NOW);
    const acc = await f.user("ACCOUNTANT");
    await prisma.payment.create({ data: { studentId: s1.id, kind: "FOOD", amount: 3000, paidAt: new Date(), registeredById: acc.id, deletedAt: new Date(), deleteReason: "x" } });
    await expect(reopenMonth(actorOf(admin), { classId: c.id, year: "2026", month: "9" })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/month-close.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/services/month-close.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { isFutureMonth } from "@/lib/dates";
import { countPresentDays, invoiceAmount } from "@/lib/billing";
import { holidayDates } from "@/services/holidays";
import { getMonthAttendance, isMonthClosed } from "@/services/attendance";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export const monthSchema = z.object({
  classId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function closeMonth(actor: Actor, input: unknown, now: Date = new Date()): Promise<{ invoices: number }> {
  requireRole(actor, "TEACHER");
  const v = parse(monthSchema, input);
  await assertClassAccess(actor, v.classId);
  if (isFutureMonth(v.year, v.month, now)) throw new AppError("FUTURE_MONTH", mn.errors.futureMonth);
  if (await isMonthClosed(v.classId, v.year, v.month)) throw new AppError("MONTH_ALREADY_CLOSED", mn.errors.monthAlreadyClosed);

  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  const [students, rows, holidays] = await Promise.all([
    prisma.student.findMany({ where: { classId: v.classId, isActive: true }, select: { id: true } }),
    getMonthAttendance(v.classId, v.year, v.month),
    holidayDates(klass.schoolYearId),
  ]);

  await prisma.$transaction(async (tx) => {
    const close = await tx.monthClose.create({
      data: { classId: v.classId, year: v.year, month: v.month, closedById: actor.userId },
    });
    for (const s of students) {
      const daysPresent = countPresentDays(rows.filter((r) => r.studentId === s.id), v.year, v.month, holidays);
      await tx.foodInvoice.create({
        data: {
          studentId: s.id,
          monthCloseId: close.id,
          year: v.year,
          month: v.month,
          daysPresent,
          rate: klass.dailyFoodRate,
          amount: invoiceAmount(daysPresent, klass.dailyFoodRate),
        },
      });
    }
  });
  return { invoices: students.length };
}

export async function reopenMonth(actor: Actor, input: unknown): Promise<void> {
  requireRole(actor, "ADMIN");
  const v = parse(monthSchema, input);
  const close = await prisma.monthClose.findUnique({
    where: { classId_year_month: { classId: v.classId, year: v.year, month: v.month } },
  });
  if (!close) throw new AppError("MONTH_NOT_CLOSED", mn.errors.monthNotClosed);
  const later = await prisma.payment.count({
    where: { kind: "FOOD", deletedAt: null, createdAt: { gt: close.closedAt }, student: { classId: v.classId } },
  });
  if (later > 0) throw new AppError("REOPEN_BLOCKED", mn.errors.reopenBlocked);
  await prisma.$transaction([
    prisma.foodInvoice.deleteMany({ where: { monthCloseId: close.id } }),
    prisma.monthClose.delete({ where: { id: close.id } }),
  ]);
}

export function listMonthCloses(classId: string) {
  return prisma.monthClose.findMany({ where: { classId }, orderBy: [{ year: "asc" }, { month: "asc" }], include: { closedBy: { select: { name: true } } } });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/month-close.test.ts`
Expected: PASS.

- [ ] **Step 5: Actions and UI**

`src/actions/month-close.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { closeMonth, reopenMonth } from "@/services/month-close";

export async function closeMonthAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await closeMonth(actor, d);
    revalidatePath(`/teacher/class/${d.classId}`, "layout");
  });
}
export async function reopenMonthAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await reopenMonth(actor, d);
    revalidatePath(`/admin/classes/${d.classId}/months`);
  });
}
```

In `src/app/teacher/class/[id]/attendance/page.tsx`, add the import and a close button next to the "all present" form:

```tsx
import { closeMonthAction } from "@/actions/month-close";
import { isFutureMonth } from "@/lib/dates";
// ... inside the toolbar div, after the markAllPresent form:
{!closed && !isFutureMonth(year, month) && (
  <ActionForm action={closeMonthAction} submitLabel={mn.attendance.closeMonth} className="inline" confirm={mn.attendance.confirmClose}>
    <input type="hidden" name="classId" value={id} />
    <input type="hidden" name="year" value={year} />
    <input type="hidden" name="month" value={month} />
  </ActionForm>
)}
```

`src/app/admin/classes/[id]/months/page.tsx`:

```tsx
import { listMonthCloses } from "@/services/month-close";
import { reopenMonthAction } from "@/actions/month-close";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const closes = await listMonthCloses(id);
  return (
    <table className="w-full border bg-white text-sm">
      <thead><tr><th className="p-2 text-left">{mn.common.month}</th><th>{mn.attendance.closedAt}</th><th /></tr></thead>
      <tbody>
        {closes.map((m) => (
          <tr key={m.id} className="border-t">
            <td className="p-2">{m.year} {mn.months[m.month - 1]}</td>
            <td className="text-center">{m.closedAt.toISOString().slice(0, 10)} · {m.closedBy.name}</td>
            <td className="p-1">
              <ActionForm action={reopenMonthAction} submitLabel={mn.attendance.reopenMonth} className="inline">
                <input type="hidden" name="classId" value={id} />
                <input type="hidden" name="year" value={m.year} />
                <input type="hidden" name="month" value={m.month} />
              </ActionForm>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Add a link to it from `src/app/admin/classes/[id]/page.tsx` under the heading:

```tsx
<a href={`/admin/classes/${c.id}/months`} className="text-sm underline">{mn.attendance.closed}</a>
```

- [ ] **Step 6: Manual check and commit**

As teacher: mark some days, close the month, confirm the grid is read-only. As admin: reopen it from the class page.

```bash
git add -A
git commit -m "feat: close month into food invoices, admin reopen with payment guard"
```

---

### Task 11: Payments and balances (accountant)

**Files:**
- Create: `src/services/payments.ts`, `src/actions/payments.ts`, `src/app/accountant/page.tsx` (replace placeholder), `src/app/accountant/students/[id]/page.tsx`, `src/app/accountant/payments/page.tsx`
- Test: `tests/services/payments.test.ts`

**Interfaces:**
- Consumes: `allocateFoodPayments`, `foodOutstanding`, `foodCredit`, `assertStudentAccess`, `getActiveSchoolYear`.
- Produces:
  - `registerPayment(actor, input: { studentId; kind; amount; paidAt; note? }, now?: Date): Promise<Payment>` ACCOUNTANT only; `paidAt` not in the future.
  - `deletePayment(actor, input: { paymentId; reason }): Promise<void>` ACCOUNTANT, only own, reason required; soft delete. Error `NOT_OWN_PAYMENT`.
  - `listPayments(actor, studentId)` non-deleted, newest first; any role with student access.
  - `listAllPayments(actor)` ACCOUNTANT/ADMIN; includes deleted, with student, class and registeredBy names.
  - `studentBalances(actor, studentId): Promise<StudentBalances>` where
    `StudentBalances = { annualFundAmount; fundPaid; fundDue; invoices: (FoodInvoice & { paid; outstanding })[]; foodInvoiced; foodPaid; foodOutstanding; foodCredit }`
  - `outstandingTable(actor, classId?): Promise<OutstandingRow[]>` where
    `OutstandingRow = { studentId; studentName; classId; className; isActive; foodDue; fundDue }`. Covers classes in the active school year. Inactive students appear only if `foodDue > 0`, with `fundDue = 0`.

- [ ] **Step 1: Failing tests**

`tests/services/payments.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { registerPayment, deletePayment, listPayments, listAllPayments, studentBalances, outstandingTable } from "@/services/payments";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z");

async function setup() {
  const acc = await f.user("ACCOUNTANT");
  const t = await f.user("TEACHER");
  const y = await f.schoolYear({ isActive: true });
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id, dailyFoodRate: 3000, annualFundAmount: 50000, name: "1А" });
  const s = await f.student(c.id, { name: "Бат" });
  const close = await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
  await prisma.foodInvoice.create({ data: { studentId: s.id, monthCloseId: close.id, year: 2026, month: 9, daysPresent: 15, rate: 3000, amount: 45000 } });
  return { acc, t, y, c, s, actor: actorOf(acc) };
}

describe("registerPayment", () => {
  it("accountant registers; teacher/admin/parent forbidden; future date and bad amount rejected", async () => {
    const { s, actor, t } = await setup();
    const p = await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "20000", paidAt: "2026-10-01", note: "Хаан банк 123" }, NOW);
    expect(p.amount).toBe(20000);
    await expect(registerPayment(actorOf(t), { studentId: s.id, kind: "FOOD", amount: "1", paidAt: "2026-10-01" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "1", paidAt: "2026-10-21" }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "-5", paidAt: "2026-10-01" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(registerPayment(actor, { studentId: s.id, kind: "GIFT", amount: "5", paidAt: "2026-10-01" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("studentBalances", () => {
  it("allocates food payments oldest first and computes fund due", async () => {
    const { s, actor } = await setup();
    await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "20000", paidAt: "2026-10-01" }, NOW);
    await registerPayment(actor, { studentId: s.id, kind: "ANNUAL_FUND", amount: "30000", paidAt: "2026-10-01" }, NOW);
    const b = await studentBalances(actor, s.id);
    expect(b).toMatchObject({ foodInvoiced: 45000, foodPaid: 20000, foodOutstanding: 25000, foodCredit: 0, fundPaid: 30000, fundDue: 20000, annualFundAmount: 50000 });
    expect(b.invoices[0]).toMatchObject({ paid: 20000, outstanding: 25000 });
  });
  it("overpayment shows credit and zero outstanding", async () => {
    const { s, actor } = await setup();
    await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "50000", paidAt: "2026-10-01" }, NOW);
    const b = await studentBalances(actor, s.id);
    expect(b).toMatchObject({ foodOutstanding: 0, foodCredit: 5000 });
  });
  it("parent can read own child's balances, not another's", async () => {
    const { s, c } = await setup();
    const p = await f.user("PARENT");
    await f.link(p.id, s.id);
    await expect(studentBalances(actorOf(p), s.id)).resolves.toBeTruthy();
    const other = await f.student(c.id);
    await expect(studentBalances(actorOf(p), other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("deletePayment", () => {
  it("soft deletes own payment with reason; excluded from sums; other accountant cannot", async () => {
    const { s, actor } = await setup();
    const p = await registerPayment(actor, { studentId: s.id, kind: "FOOD", amount: "20000", paidAt: "2026-10-01" }, NOW);
    const acc2 = await f.user("ACCOUNTANT");
    await expect(deletePayment(actorOf(acc2), { paymentId: p.id, reason: "x" })).rejects.toMatchObject({ code: "NOT_OWN_PAYMENT" });
    await expect(deletePayment(actor, { paymentId: p.id, reason: "" })).rejects.toMatchObject({ code: "VALIDATION" });
    await deletePayment(actor, { paymentId: p.id, reason: "Буруу сурагч" });
    expect((await studentBalances(actor, s.id)).foodPaid).toBe(0);
    expect(await listPayments(actor, s.id)).toEqual([]);
    const all = await listAllPayments(actor);
    expect(all[0].deleteReason).toBe("Буруу сурагч");
  });
});

describe("outstandingTable", () => {
  it("lists active-year students with dues; inactive only when food is owed; class filter", async () => {
    const { s, c, actor } = await setup();
    const s2 = await f.student(c.id, { name: "Сарнай" }); // no invoice, owes fund only
    const inactivePaid = await f.student(c.id, { isActive: false }); // nothing owed -> hidden
    const inactiveOwing = await f.student(c.id, { isActive: false, name: "Явсан" });
    const close = await prisma.monthClose.findFirstOrThrow();
    await prisma.foodInvoice.create({ data: { studentId: inactiveOwing.id, monthCloseId: close.id, year: 2026, month: 9, daysPresent: 1, rate: 3000, amount: 3000 } });
    const otherClass = await f.klass({ schoolYearId: c.schoolYearId, name: "2Б" });
    await f.student(otherClass.id);

    const rows = await outstandingTable(actor);
    const byId = Object.fromEntries(rows.map((r) => [r.studentId, r]));
    expect(byId[s.id]).toMatchObject({ foodDue: 45000, fundDue: 50000, className: "1А" });
    expect(byId[s2.id]).toMatchObject({ foodDue: 0, fundDue: 50000 });
    expect(byId[inactivePaid.id]).toBeUndefined();
    expect(byId[inactiveOwing.id]).toMatchObject({ foodDue: 3000, fundDue: 0, isActive: false });
    expect(rows).toHaveLength(4);
    expect((await outstandingTable(actor, otherClass.id))).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/payments.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/services/payments.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertStudentAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { moneySchema } from "@/lib/money";
import { parseDateOnly, isFuture } from "@/lib/dates";
import { allocateFoodPayments, foodOutstanding, foodCredit } from "@/lib/billing";
import { dateStringSchema, getActiveSchoolYear } from "@/services/school-years";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { PAYMENT_KINDS, type Actor } from "@/lib/roles";
import type { FoodInvoice } from "@prisma/client";

const registerSchema = z.object({
  studentId: z.string().min(1),
  kind: z.enum(PAYMENT_KINDS),
  amount: moneySchema,
  paidAt: dateStringSchema,
  note: z.string().trim().max(500).optional().default(""),
});

export async function registerPayment(actor: Actor, input: unknown, now: Date = new Date()) {
  requireRole(actor, "ACCOUNTANT");
  const v = parse(registerSchema, input);
  await assertStudentAccess(actor, v.studentId);
  const paidAt = parseDateOnly(v.paidAt);
  if (isFuture(paidAt, now)) throw new AppError("FUTURE_DATE", mn.errors.futureDate);
  return prisma.payment.create({
    data: { studentId: v.studentId, kind: v.kind, amount: v.amount, paidAt, note: v.note, registeredById: actor.userId },
  });
}

const deleteSchema = z.object({ paymentId: z.string().min(1), reason: z.string().trim().min(1, mn.errors.required) });

export async function deletePayment(actor: Actor, input: unknown): Promise<void> {
  requireRole(actor, "ACCOUNTANT");
  const v = parse(deleteSchema, input);
  const p = await prisma.payment.findUnique({ where: { id: v.paymentId } });
  if (!p || p.deletedAt) throw new AppError("NOT_FOUND", mn.errors.notFound);
  if (p.registeredById !== actor.userId) throw new AppError("NOT_OWN_PAYMENT", mn.errors.notOwnPayment);
  await prisma.payment.update({ where: { id: p.id }, data: { deletedAt: new Date(), deleteReason: v.reason } });
}

export async function listPayments(actor: Actor, studentId: string) {
  await assertStudentAccess(actor, studentId);
  return prisma.payment.findMany({
    where: { studentId, deletedAt: null },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: { registeredBy: { select: { name: true } } },
  });
}

export function listAllPayments(actor: Actor) {
  requireRole(actor, "ACCOUNTANT", "ADMIN");
  return prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { student: { select: { name: true, class: { select: { name: true } } } }, registeredBy: { select: { name: true } } },
  });
}

export type StudentBalances = {
  annualFundAmount: number;
  fundPaid: number;
  fundDue: number;
  invoices: (FoodInvoice & { paid: number; outstanding: number })[];
  foodInvoiced: number;
  foodPaid: number;
  foodOutstanding: number;
  foodCredit: number;
};

export async function studentBalances(actor: Actor, studentId: string): Promise<StudentBalances> {
  await assertStudentAccess(actor, studentId);
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { class: true } });
  const [invoices, sums] = await Promise.all([
    prisma.foodInvoice.findMany({ where: { studentId } }),
    prisma.payment.groupBy({ by: ["kind"], where: { studentId, deletedAt: null }, _sum: { amount: true } }),
  ]);
  const paidOf = (kind: string) => sums.find((s) => s.kind === kind)?._sum.amount ?? 0;
  const foodPaid = paidOf("FOOD");
  const fundPaid = paidOf("ANNUAL_FUND");
  const foodInvoiced = invoices.reduce((a, i) => a + i.amount, 0);
  return {
    annualFundAmount: student.class.annualFundAmount,
    fundPaid,
    fundDue: Math.max(0, student.class.annualFundAmount - fundPaid),
    invoices: allocateFoodPayments(invoices, foodPaid),
    foodInvoiced,
    foodPaid,
    foodOutstanding: foodOutstanding(foodInvoiced, foodPaid),
    foodCredit: foodCredit(foodInvoiced, foodPaid),
  };
}

export type OutstandingRow = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  isActive: boolean;
  foodDue: number;
  fundDue: number;
};

export async function outstandingTable(actor: Actor, classId?: string): Promise<OutstandingRow[]> {
  requireRole(actor, "ACCOUNTANT", "ADMIN");
  const year = await getActiveSchoolYear();
  const students = await prisma.student.findMany({
    where: { class: { schoolYearId: year.id, ...(classId ? { id: classId } : {}) } },
    include: { class: { select: { id: true, name: true, annualFundAmount: true } } },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });
  const ids = students.map((s) => s.id);
  const [inv, pay] = await Promise.all([
    prisma.foodInvoice.groupBy({ by: ["studentId"], where: { studentId: { in: ids } }, _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ["studentId", "kind"], where: { studentId: { in: ids }, deletedAt: null }, _sum: { amount: true } }),
  ]);
  const invoiced = new Map(inv.map((r) => [r.studentId, r._sum.amount ?? 0]));
  const paid = new Map(pay.map((r) => [`${r.studentId}|${r.kind}`, r._sum.amount ?? 0]));
  const rows: OutstandingRow[] = [];
  for (const s of students) {
    const foodDue = foodOutstanding(invoiced.get(s.id) ?? 0, paid.get(`${s.id}|FOOD`) ?? 0);
    const fundDue = s.isActive ? Math.max(0, s.class.annualFundAmount - (paid.get(`${s.id}|ANNUAL_FUND`) ?? 0)) : 0;
    if (!s.isActive && foodDue === 0) continue;
    rows.push({ studentId: s.id, studentName: s.name, classId: s.class.id, className: s.class.name, isActive: s.isActive, foodDue, fundDue });
  }
  return rows;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/payments.test.ts`
Expected: PASS.

- [ ] **Step 5: Actions**

`src/actions/payments.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { registerPayment, deletePayment } from "@/services/payments";

export async function registerPaymentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await registerPayment(actor, d);
    revalidatePath(`/accountant/students/${d.studentId}`);
    revalidatePath("/accountant");
  });
}
export async function deletePaymentAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deletePayment(actor, d);
    revalidatePath("/accountant", "layout");
  });
}
```

- [ ] **Step 6: Pages**

Replace `src/app/accountant/page.tsx`:

```tsx
import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { outstandingTable } from "@/services/payments";
import { getActiveSchoolYear } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const { classId } = await searchParams;
  const year = await getActiveSchoolYear();
  const classes = await listClasses(year.id);
  const rows = await outstandingTable(actor, classId || undefined);
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{mn.nav.outstanding} — {year.name}</h1>
      <form className="mb-2 text-sm">
        <select name="classId" defaultValue={classId ?? ""} className="rounded border p-1">
          <option value="">{mn.common.filterAll}</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>{" "}<button className="underline">OK</button>
      </form>
      <table className="w-full border bg-white text-sm">
        <thead><tr><th className="p-2 text-left">{mn.common.class}</th><th className="text-left">{mn.common.student}</th><th>{mn.payment.foodDue}</th><th>{mn.payment.fundDue}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className="border-t">
              <td className="p-2">{r.className}</td>
              <td><Link href={`/accountant/students/${r.studentId}`} className="underline">{r.studentName}</Link>{!r.isActive && ` (${mn.common.inactive})`}</td>
              <td className="text-right"><Money v={r.foodDue} /></td>
              <td className="text-right"><Money v={r.fundDue} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>{mn.common.total}</td>
          <td className="text-right"><Money v={rows.reduce((a, r) => a + r.foodDue, 0)} /></td>
          <td className="text-right"><Money v={rows.reduce((a, r) => a + r.fundDue, 0)} /></td></tr></tfoot>
      </table>
    </div>
  );
}
```

`src/components/StudentBalances.tsx` (shared by accountant and parent):

```tsx
import { Money } from "@/components/Money";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { StudentBalances } from "@/services/payments";

type PaymentRow = { id: string; kind: string; amount: number; paidAt: Date; note: string; registeredBy: { name: string } };

export function StudentBalancesView({ b, payments }: { b: StudentBalances; payments: PaymentRow[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{mn.invoice.title}</h2>
        <table className="w-full">
          <thead><tr><th className="text-left">{mn.common.month}</th><th>{mn.attendance.daysPresent}</th><th>{mn.invoice.amount}</th><th>{mn.invoice.paid}</th><th>{mn.invoice.outstanding}</th></tr></thead>
          <tbody>
            {b.invoices.map((i) => (
              <tr key={i.id} className="border-t">
                <td>{i.year} {mn.months[i.month - 1]}</td>
                <td className="text-center">{i.daysPresent}</td>
                <td className="text-right"><Money v={i.amount} /></td>
                <td className="text-right"><Money v={i.paid} /></td>
                <td className="text-right"><Money v={i.outstanding} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2">{mn.payment.foodDue}: <b><Money v={b.foodOutstanding} /></b>{b.foodCredit > 0 && <> · {mn.invoice.credit}: <Money v={b.foodCredit} /></>}</p>
        <p>{mn.payment.ANNUAL_FUND}: {mn.invoice.paid} <Money v={b.fundPaid} /> / <Money v={b.annualFundAmount} /> · {mn.payment.fundDue}: <b><Money v={b.fundDue} /></b></p>
      </section>
      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">{mn.payment.history}</h2>
        <table className="w-full">
          <thead><tr><th className="text-left">{mn.payment.paidAt}</th><th>{mn.payment.kind}</th><th>{mn.common.amount}</th><th>{mn.common.note}</th><th>{mn.payment.registeredBy}</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t">
                <td>{toISODate(p.paidAt)}</td>
                <td className="text-center">{mn.payment[p.kind as "FOOD" | "ANNUAL_FUND"]}</td>
                <td className="text-right"><Money v={p.amount} /></td>
                <td>{p.note}</td>
                <td>{p.registeredBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

`src/app/accountant/students/[id]/page.tsx`:

```tsx
import { requirePage } from "@/lib/page-auth";
import { studentBalances, listPayments } from "@/services/payments";
import { registerPaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";
import { StudentBalancesView } from "@/components/StudentBalances";
import { prisma } from "@/lib/db";
import { toISODate, todayDate } from "@/lib/dates";
import { PAYMENT_KINDS } from "@/lib/roles";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const { id } = await params;
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: { class: true } });
  const [b, payments] = await Promise.all([studentBalances(actor, id), listPayments(actor, id)]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{student.class.name} · {student.name}</h1>
      <StudentBalancesView b={b} payments={payments} />
      {actor.role === "ACCOUNTANT" && (
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-semibold">{mn.payment.register}</h2>
          <ActionForm action={registerPaymentAction} submitLabel={mn.common.save} className="grid gap-2 md:grid-cols-5">
            <input type="hidden" name="studentId" value={id} />
            <select name="kind" className="rounded border p-1">
              {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{mn.payment[k]}</option>)}
            </select>
            <input name="amount" type="number" min={1} step={1} required placeholder={mn.common.amount} className="rounded border p-1" />
            <input name="paidAt" type="date" required defaultValue={toISODate(todayDate())} className="rounded border p-1" />
            <input name="note" placeholder={mn.common.note} className="rounded border p-1" />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
```

`src/app/accountant/payments/page.tsx`:

```tsx
import { requirePage } from "@/lib/page-auth";
import { listAllPayments } from "@/services/payments";
import { deletePaymentAction } from "@/actions/payments";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page() {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const payments = await listAllPayments(actor);
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{mn.nav.payments}</h1>
      <table className="w-full border bg-white text-sm">
        <thead><tr><th className="p-2 text-left">{mn.payment.paidAt}</th><th>{mn.common.class}</th><th>{mn.common.student}</th><th>{mn.payment.kind}</th><th>{mn.common.amount}</th><th>{mn.common.note}</th><th>{mn.payment.registeredBy}</th><th>{mn.common.actions}</th></tr></thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className={`border-t ${p.deletedAt ? "text-gray-400 line-through" : ""}`}>
              <td className="p-2">{toISODate(p.paidAt)}</td>
              <td>{p.student.class.name}</td>
              <td>{p.student.name}</td>
              <td>{mn.payment[p.kind as "FOOD" | "ANNUAL_FUND"]}</td>
              <td className="text-right"><Money v={p.amount} /></td>
              <td>{p.note}</td>
              <td>{p.registeredBy.name}</td>
              <td className="p-1">
                {p.deletedAt ? (
                  <span className="no-underline">{mn.payment.deleted}: {p.deleteReason}</span>
                ) : p.registeredById === actor.userId ? (
                  <ActionForm action={deletePaymentAction} submitLabel={mn.common.delete} className="flex gap-1">
                    <input type="hidden" name="paymentId" value={p.id} />
                    <input name="reason" required placeholder={mn.common.reason} className="w-32 rounded border p-1" />
                  </ActionForm>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: Manual check and commit**

As accountant: see outstanding, open a student, register a food payment and a fund payment, delete one with a reason.

```bash
git add -A
git commit -m "feat: accountant outstanding table, payment registration and soft delete"
```

---

### Task 12: Expenses (teacher)

**Files:**
- Create: `src/services/expenses.ts`, `src/actions/expenses.ts`, `src/app/teacher/class/[id]/expenses/page.tsx`
- Test: `tests/services/expenses.test.ts`

**Interfaces:**
- Produces:
  - `addExpense(actor, input: { classId; date; title; amount; note? }, now?: Date): Promise<Expense>` TEACHER (own class). `schoolYearId` copied from the class. Date not future.
  - `updateExpense(actor, expenseId, input: { date; title; amount; note? }, now?: Date): Promise<Expense>`
  - `deleteExpense(actor, expenseId): Promise<void>` TEACHER own class or ADMIN.
  - `listExpenses(actor, classId)` any role with class access; ordered by date desc.

- [ ] **Step 1: Failing tests**

`tests/services/expenses.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addExpense, updateExpense, deleteExpense, listExpenses } from "@/services/expenses";
import { f, actorOf } from "../helpers/db";

const NOW = new Date("2026-10-20T04:00:00Z");

async function setup() {
  const t = await f.user("TEACHER");
  const c = await f.klass({ teacherId: t.id });
  return { t, c, actor: actorOf(t) };
}

describe("expenses", () => {
  it("teacher adds to own class; schoolYear copied; future and bad amount rejected", async () => {
    const { c, actor } = await setup();
    const e = await addExpense(actor, { classId: c.id, date: "2026-10-10", title: "Ус", amount: "12000", note: "20л x 2" }, NOW);
    expect(e.schoolYearId).toBe(c.schoolYearId);
    await expect(addExpense(actor, { classId: c.id, date: "2026-10-21", title: "x", amount: "1" }, NOW)).rejects.toMatchObject({ code: "FUTURE_DATE" });
    await expect(addExpense(actor, { classId: c.id, date: "2026-10-10", title: "", amount: "1" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(addExpense(actor, { classId: c.id, date: "2026-10-10", title: "x", amount: "0" }, NOW)).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("other teacher and accountant cannot add or delete; admin can delete", async () => {
    const { c, actor } = await setup();
    const e = await addExpense(actor, { classId: c.id, date: "2026-10-10", title: "Ус", amount: "12000" }, NOW);
    const t2 = await f.user("TEACHER");
    await expect(addExpense(actorOf(t2), { classId: c.id, date: "2026-10-10", title: "x", amount: "1" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteExpense(actorOf(t2), e.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(addExpense(actorOf(acc), { classId: c.id, date: "2026-10-10", title: "x", amount: "1" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await f.user("ADMIN");
    await deleteExpense(actorOf(admin), e.id);
    expect(await listExpenses(actorOf(admin), c.id)).toEqual([]);
  });
  it("updates and lists newest first; parent can list own child's class", async () => {
    const { c, actor } = await setup();
    const a = await addExpense(actor, { classId: c.id, date: "2026-10-01", title: "A", amount: "100" }, NOW);
    await addExpense(actor, { classId: c.id, date: "2026-10-05", title: "B", amount: "200" }, NOW);
    await updateExpense(actor, a.id, { date: "2026-10-02", title: "A2", amount: "150" }, NOW);
    const list = await listExpenses(actor, c.id);
    expect(list.map((e) => e.title)).toEqual(["B", "A2"]);
    expect(list[1].amount).toBe(150);
    const p = await f.user("PARENT");
    const s = await f.student(c.id);
    await f.link(p.id, s.id);
    expect(await listExpenses(actorOf(p), c.id)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/services/expenses.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/services/expenses.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { parse } from "@/lib/validate";
import { moneySchema } from "@/lib/money";
import { parseDateOnly, isFuture } from "@/lib/dates";
import { dateStringSchema } from "@/services/school-years";
import { AppError, NotFoundError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

const fieldsSchema = z.object({
  date: dateStringSchema,
  title: z.string().trim().min(1, mn.errors.required),
  amount: moneySchema,
  note: z.string().trim().max(500).optional().default(""),
});
const addSchema = fieldsSchema.extend({ classId: z.string().min(1) });

function dateOrThrow(s: string, now: Date): Date {
  const d = parseDateOnly(s);
  if (isFuture(d, now)) throw new AppError("FUTURE_DATE", mn.errors.futureDate);
  return d;
}

export async function addExpense(actor: Actor, input: unknown, now: Date = new Date()) {
  requireRole(actor, "TEACHER");
  const v = parse(addSchema, input);
  await assertClassAccess(actor, v.classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: v.classId } });
  return prisma.expense.create({
    data: { classId: v.classId, schoolYearId: klass.schoolYearId, date: dateOrThrow(v.date, now), title: v.title, amount: v.amount, note: v.note, createdById: actor.userId },
  });
}

export async function updateExpense(actor: Actor, expenseId: string, input: unknown, now: Date = new Date()) {
  requireRole(actor, "TEACHER");
  const v = parse(fieldsSchema, input);
  const e = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!e) throw new NotFoundError();
  await assertClassAccess(actor, e.classId);
  return prisma.expense.update({ where: { id: expenseId }, data: { date: dateOrThrow(v.date, now), title: v.title, amount: v.amount, note: v.note } });
}

export async function deleteExpense(actor: Actor, expenseId: string): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  const e = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!e) throw new NotFoundError();
  await assertClassAccess(actor, e.classId);
  await prisma.expense.delete({ where: { id: expenseId } });
}

export async function listExpenses(actor: Actor, classId: string) {
  await assertClassAccess(actor, classId);
  return prisma.expense.findMany({ where: { classId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/services/expenses.test.ts`
Expected: PASS.

- [ ] **Step 5: Actions and page**

`src/actions/expenses.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { addExpense, updateExpense, deleteExpense } from "@/services/expenses";

const page = (classId: string) => `/teacher/class/${classId}`;

export async function addExpenseAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await addExpense(actor, d);
    revalidatePath(page(d.classId), "layout");
  });
}
export async function updateExpenseAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await updateExpense(actor, d.expenseId, d);
    revalidatePath(page(d.classId), "layout");
  });
}
export async function deleteExpenseAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await deleteExpense(actor, d.expenseId);
    revalidatePath(page(d.classId), "layout");
  });
}
```

`src/app/teacher/class/[id]/expenses/page.tsx`:

```tsx
import { requirePage } from "@/lib/page-auth";
import { listExpenses } from "@/services/expenses";
import { addExpenseAction, updateExpenseAction, deleteExpenseAction } from "@/actions/expenses";
import { ActionForm } from "@/components/ActionForm";
import { Money } from "@/components/Money";
import { toISODate, todayDate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("TEACHER");
  const { id } = await params;
  const expenses = await listExpenses(actor, id);
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="md:col-span-2">
        <table className="w-full border bg-white text-sm">
          <thead><tr><th className="p-2 text-left">{mn.common.date}</th><th className="text-left">{mn.expense.itemTitle}</th><th>{mn.common.amount}</th><th className="text-left">{mn.common.note}</th><th>{mn.common.actions}</th></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t align-top">
                <td className="p-2">{toISODate(e.date)}</td>
                <td className="p-2">{e.title}</td>
                <td className="p-2 text-right"><Money v={e.amount} /></td>
                <td className="p-2">{e.note}</td>
                <td className="p-2">
                  <details>
                    <summary className="cursor-pointer text-blue-700">{mn.common.edit}</summary>
                    <ActionForm action={updateExpenseAction} submitLabel={mn.common.save}>
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="expenseId" value={e.id} />
                      <input name="date" type="date" defaultValue={toISODate(e.date)} className="rounded border p-1" />
                      <input name="title" defaultValue={e.title} className="rounded border p-1" />
                      <input name="amount" type="number" min={1} step={1} defaultValue={e.amount} className="rounded border p-1" />
                      <input name="note" defaultValue={e.note} className="rounded border p-1" />
                    </ActionForm>
                  </details>
                  <ActionForm action={deleteExpenseAction} submitLabel={mn.common.delete} className="inline">
                    <input type="hidden" name="classId" value={id} />
                    <input type="hidden" name="expenseId" value={e.id} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>{mn.common.total}</td><td className="p-2 text-right"><Money v={total} /></td><td colSpan={2} /></tr></tfoot>
        </table>
      </section>
      <section className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">{mn.expense.add}</h2>
        <ActionForm action={addExpenseAction} submitLabel={mn.common.add}>
          <input type="hidden" name="classId" value={id} />
          <input name="date" type="date" required defaultValue={toISODate(todayDate())} className="rounded border p-1" />
          <input name="title" required placeholder={mn.expense.itemTitle} className="rounded border p-1" />
          <input name="amount" type="number" min={1} step={1} required placeholder={mn.common.amount} className="rounded border p-1" />
          <input name="note" placeholder={mn.common.note} className="rounded border p-1" />
        </ActionForm>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Manual check and commit**

As teacher, add, edit and delete an expense.

```bash
git add -A
git commit -m "feat: class expenses for teachers"
```

---

### Task 13: Reports and CSV export

**Files:**
- Create: `src/services/reports.ts`, `src/lib/csv.ts`, `src/components/FundReport.tsx`, `src/components/FoodReport.tsx`, `src/app/api/reports/fund/route.ts`, `src/app/api/reports/food/route.ts`, `src/app/teacher/class/[id]/report/page.tsx`, `src/app/accountant/report/page.tsx`, `src/app/admin/classes/[id]/report/page.tsx`
- Test: `tests/unit/csv.test.ts`, `tests/services/reports.test.ts`

**Interfaces:**
- Consumes: `fundBalance`, `allocateFoodPayments`, `assertClassAccess`, `listExpenses`.
- Produces:
  - `toCsv(rows: (string | number)[][]): string` — RFC 4180 quoting, CRLF, UTF-8 BOM prefix.
  - `classFundReport(actor, classId): Promise<FundReport>` where `FundReport = { className; annualFundAmount; collected; spent; balance; expenses: Expense[]; contributions: { studentId; name; isActive; paid; due }[] }`. Roles: TEACHER (own), ADMIN, PARENT (child in class). ACCOUNTANT is allowed too (read-only, harmless).
  - `monthlyFoodReport(actor, classId, year, month): Promise<FoodReport>` where `FoodReport = { className; year; month; closed: boolean; rows: { studentId; name; daysPresent; amount; paid; outstanding }[]; totals: { amount; paid; outstanding } }`. Roles: TEACHER (own), ADMIN, ACCOUNTANT. Uses allocation across all the student's invoices so `paid` is this month's allocated share.
  - `fundReportCsv(r: FundReport): string`, `foodReportCsv(r: FoodReport): string`.

- [ ] **Step 1: Failing tests**

`tests/unit/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("starts with BOM, quotes commas/quotes/newlines, uses CRLF", () => {
    const out = toCsv([["Нэр", "Дүн"], ["Бат, Б", 3000], ['He said "hi"', 'a\nb']]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.slice(1)).toBe('Нэр,Дүн\r\n"Бат, Б",3000\r\n"He said ""hi""","a\nb"');
  });
});
```

`tests/services/reports.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classFundReport, monthlyFoodReport } from "@/services/reports";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

async function setup() {
  const t = await f.user("TEACHER");
  const acc = await f.user("ACCOUNTANT");
  const y = await f.schoolYear();
  const c = await f.klass({ teacherId: t.id, schoolYearId: y.id, annualFundAmount: 50000, name: "1А" });
  const s1 = await f.student(c.id, { name: "А" });
  const s2 = await f.student(c.id, { name: "Б" });
  const pay = (studentId: string, kind: string, amount: number) =>
    prisma.payment.create({ data: { studentId, kind, amount, paidAt: new Date("2026-10-01T00:00:00Z"), registeredById: acc.id } });
  return { t, acc, y, c, s1, s2, pay, actor: actorOf(t) };
}

describe("classFundReport", () => {
  it("sums contributions and expenses; excludes deleted payments", async () => {
    const { c, s1, s2, pay, actor, t, acc } = await setup();
    await pay(s1.id, "ANNUAL_FUND", 50000);
    await pay(s2.id, "ANNUAL_FUND", 20000);
    await pay(s2.id, "FOOD", 999); // not fund
    await prisma.payment.create({ data: { studentId: s2.id, kind: "ANNUAL_FUND", amount: 5000, paidAt: new Date(), registeredById: acc.id, deletedAt: new Date(), deleteReason: "x" } });
    await prisma.expense.create({ data: { classId: c.id, schoolYearId: c.schoolYearId, date: new Date("2026-10-02T00:00:00Z"), title: "Ус", amount: 12000, createdById: t.id } });
    const r = await classFundReport(actor, c.id);
    expect(r).toMatchObject({ className: "1А", collected: 70000, spent: 12000, balance: 58000 });
    expect(r.contributions.map((x) => [x.name, x.paid, x.due])).toEqual([["А", 50000, 0], ["Б", 20000, 30000]]);
  });
  it("parent of a child in the class can read; unrelated parent cannot", async () => {
    const { c, s1 } = await setup();
    const p = await f.user("PARENT");
    await f.link(p.id, s1.id);
    await expect(classFundReport(actorOf(p), c.id)).resolves.toBeTruthy();
    const p2 = await f.user("PARENT");
    await expect(classFundReport(actorOf(p2), c.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("monthlyFoodReport", () => {
  it("shows per-student invoice, allocated paid and outstanding; totals", async () => {
    const { c, s1, s2, pay, actor, t, acc } = await setup();
    const sep = await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 9, closedById: t.id } });
    const oct = await prisma.monthClose.create({ data: { classId: c.id, year: 2026, month: 10, closedById: t.id } });
    await prisma.foodInvoice.create({ data: { studentId: s1.id, monthCloseId: sep.id, year: 2026, month: 9, daysPresent: 10, rate: 3000, amount: 30000 } });
    await prisma.foodInvoice.create({ data: { studentId: s1.id, monthCloseId: oct.id, year: 2026, month: 10, daysPresent: 5, rate: 3000, amount: 15000 } });
    await prisma.foodInvoice.create({ data: { studentId: s2.id, monthCloseId: oct.id, year: 2026, month: 10, daysPresent: 4, rate: 3000, amount: 12000 } });
    await pay(s1.id, "FOOD", 35000); // 30000 -> Sep, 5000 -> Oct
    const r = await monthlyFoodReport(actor, c.id, 2026, 10);
    expect(r.closed).toBe(true);
    expect(r.rows.map((x) => [x.name, x.daysPresent, x.amount, x.paid, x.outstanding])).toEqual([["А", 5, 15000, 5000, 10000], ["Б", 4, 12000, 0, 12000]]);
    expect(r.totals).toEqual({ amount: 27000, paid: 5000, outstanding: 22000 });
    expect((await monthlyFoodReport(actorOf(acc), c.id, 2026, 11)).closed).toBe(false);
    const p = await f.user("PARENT");
    await expect(monthlyFoodReport(actorOf(p), c.id, 2026, 10)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/unit/csv.test.ts tests/services/reports.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/lib/csv.ts`:

```ts
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
```

`src/services/reports.ts`:

```ts
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { fundBalance, allocateFoodPayments } from "@/lib/billing";
import { listExpenses } from "@/services/expenses";
import { isMonthClosed } from "@/services/attendance";
import { toCsv } from "@/lib/csv";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";
import type { Expense } from "@prisma/client";

export type FundReport = {
  className: string;
  annualFundAmount: number;
  collected: number;
  spent: number;
  balance: number;
  expenses: Expense[];
  contributions: { studentId: string; name: string; isActive: boolean; paid: number; due: number }[];
};

export async function classFundReport(actor: Actor, classId: string): Promise<FundReport> {
  await assertClassAccess(actor, classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const [students, sums, expenses] = await Promise.all([
    prisma.student.findMany({ where: { classId }, orderBy: { name: "asc" } }),
    prisma.payment.groupBy({ by: ["studentId"], where: { kind: "ANNUAL_FUND", deletedAt: null, student: { classId } }, _sum: { amount: true } }),
    listExpenses(actor, classId),
  ]);
  const paidBy = new Map(sums.map((s) => [s.studentId, s._sum.amount ?? 0]));
  const contributions = students.map((s) => {
    const paid = paidBy.get(s.id) ?? 0;
    return { studentId: s.id, name: s.name, isActive: s.isActive, paid, due: s.isActive ? Math.max(0, klass.annualFundAmount - paid) : 0 };
  });
  const collected = contributions.reduce((a, c) => a + c.paid, 0);
  const spent = expenses.reduce((a, e) => a + e.amount, 0);
  return { className: klass.name, annualFundAmount: klass.annualFundAmount, collected, spent, balance: fundBalance(collected, spent), expenses, contributions };
}

export type FoodReport = {
  className: string;
  year: number;
  month: number;
  closed: boolean;
  rows: { studentId: string; name: string; daysPresent: number; amount: number; paid: number; outstanding: number }[];
  totals: { amount: number; paid: number; outstanding: number };
};

export async function monthlyFoodReport(actor: Actor, classId: string, year: number, month: number): Promise<FoodReport> {
  requireRole(actor, "TEACHER", "ADMIN", "ACCOUNTANT");
  await assertClassAccess(actor, classId);
  const klass = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const invoices = await prisma.foodInvoice.findMany({
    where: { student: { classId } },
    include: { student: { select: { id: true, name: true } } },
  });
  const studentIds = [...new Set(invoices.map((i) => i.studentId))];
  const paidRows = await prisma.payment.groupBy({ by: ["studentId"], where: { kind: "FOOD", deletedAt: null, studentId: { in: studentIds } }, _sum: { amount: true } });
  const paidBy = new Map(paidRows.map((p) => [p.studentId, p._sum.amount ?? 0]));
  const rows: FoodReport["rows"] = [];
  for (const sid of studentIds) {
    const mine = invoices.filter((i) => i.studentId === sid);
    const allocated = allocateFoodPayments(mine, paidBy.get(sid) ?? 0);
    const inv = allocated.find((i) => i.year === year && i.month === month);
    if (!inv) continue;
    rows.push({ studentId: sid, name: inv.student.name, daysPresent: inv.daysPresent, amount: inv.amount, paid: inv.paid, outstanding: inv.outstanding });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const totals = rows.reduce((t, r) => ({ amount: t.amount + r.amount, paid: t.paid + r.paid, outstanding: t.outstanding + r.outstanding }), { amount: 0, paid: 0, outstanding: 0 });
  return { className: klass.name, year, month, closed: await isMonthClosed(classId, year, month), rows, totals };
}

export function fundReportCsv(r: FundReport): string {
  const rows: (string | number)[][] = [
    [mn.report.fund, r.className],
    [mn.report.collected, r.collected],
    [mn.report.spent, r.spent],
    [mn.report.balance, r.balance],
    [],
    [mn.report.contributions],
    [mn.common.student, mn.invoice.paid, mn.report.due],
    ...r.contributions.map((c) => [c.name, c.paid, c.due]),
    [],
    [mn.expense.title],
    [mn.common.date, mn.expense.itemTitle, mn.common.amount, mn.common.note],
    ...r.expenses.map((e) => [toISODate(e.date), e.title, e.amount, e.note]),
  ];
  return toCsv(rows);
}

export function foodReportCsv(r: FoodReport): string {
  return toCsv([
    [mn.report.food, r.className, `${r.year} ${mn.months[r.month - 1]}`],
    [mn.common.student, mn.attendance.daysPresent, mn.invoice.amount, mn.invoice.paid, mn.invoice.outstanding],
    ...r.rows.map((x) => [x.name, x.daysPresent, x.amount, x.paid, x.outstanding]),
    [mn.common.total, "", r.totals.amount, r.totals.paid, r.totals.outstanding],
  ]);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/unit/csv.test.ts tests/services/reports.test.ts`
Expected: PASS.

- [ ] **Step 5: CSV route handlers**

`src/app/api/reports/fund/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { classFundReport, fundReportCsv } from "@/services/reports";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const classId = req.nextUrl.searchParams.get("classId") ?? "";
  try {
    const r = await classFundReport(actor, classId);
    return new Response(fundReportCsv(r), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fund-${r.className}.csv"` },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(e.message, { status: e.code === "FORBIDDEN" ? 403 : 400 });
    throw e;
  }
}
```

`src/app/api/reports/food/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { monthlyFoodReport, foodReportCsv } from "@/services/reports";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const q = req.nextUrl.searchParams;
  try {
    const r = await monthlyFoodReport(actor, q.get("classId") ?? "", Number(q.get("year")), Number(q.get("month")));
    return new Response(foodReportCsv(r), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="food-${r.className}-${r.year}-${r.month}.csv"` },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(e.message, { status: e.code === "FORBIDDEN" ? 403 : 400 });
    throw e;
  }
}
```

- [ ] **Step 6: Report components and pages**

`src/components/FundReport.tsx`:

```tsx
import { Money } from "@/components/Money";
import { toISODate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";
import type { FundReport } from "@/services/reports";

export function FundReportView({ r, classId }: { r: FundReport; classId: string }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{mn.report.fund} — {r.className}</h2>
        <a href={`/api/reports/fund?classId=${classId}`} className="underline">{mn.common.downloadCsv}</a>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[[mn.report.collected, r.collected], [mn.report.spent, r.spent], [mn.report.balance, r.balance]].map(([l, v]) => (
          <div key={String(l)} className="rounded border bg-white p-3"><div className="text-gray-500">{l}</div><div className="text-lg font-semibold"><Money v={Number(v)} /></div></div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <table className="w-full border bg-white">
          <thead><tr><th className="p-2 text-left" colSpan={3}>{mn.report.contributions} ({mn.class.annualFundAmount}: <Money v={r.annualFundAmount} />)</th></tr>
            <tr><th className="text-left p-2">{mn.common.student}</th><th>{mn.invoice.paid}</th><th>{mn.report.due}</th></tr></thead>
          <tbody>{r.contributions.map((c) => (
            <tr key={c.studentId} className="border-t"><td className="p-2">{c.name}{!c.isActive && ` (${mn.common.inactive})`}</td><td className="text-right"><Money v={c.paid} /></td><td className="text-right"><Money v={c.due} /></td></tr>
          ))}</tbody>
        </table>
        <table className="w-full border bg-white">
          <thead><tr><th className="p-2 text-left" colSpan={4}>{mn.expense.title}</th></tr>
            <tr><th className="text-left p-2">{mn.common.date}</th><th className="text-left">{mn.expense.itemTitle}</th><th>{mn.common.amount}</th><th className="text-left">{mn.common.note}</th></tr></thead>
          <tbody>{r.expenses.map((e) => (
            <tr key={e.id} className="border-t"><td className="p-2">{toISODate(e.date)}</td><td>{e.title}</td><td className="text-right"><Money v={e.amount} /></td><td>{e.note}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
```

`src/components/FoodReport.tsx`:

```tsx
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";
import type { FoodReport } from "@/services/reports";

export function FoodReportView({ r, classId }: { r: FoodReport; classId: string }) {
  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center gap-4">
        <h2 className="text-lg font-semibold">{mn.report.food} — {r.className} · {r.year} {mn.months[r.month - 1]}</h2>
        {!r.closed && <span className="rounded bg-yellow-100 px-2">{mn.errors.monthNotClosed}</span>}
        <a href={`/api/reports/food?classId=${classId}&year=${r.year}&month=${r.month}`} className="underline">{mn.common.downloadCsv}</a>
      </div>
      <table className="w-full border bg-white">
        <thead><tr><th className="p-2 text-left">{mn.common.student}</th><th>{mn.attendance.daysPresent}</th><th>{mn.invoice.amount}</th><th>{mn.invoice.paid}</th><th>{mn.invoice.outstanding}</th></tr></thead>
        <tbody>{r.rows.map((x) => (
          <tr key={x.studentId} className="border-t"><td className="p-2">{x.name}</td><td className="text-center">{x.daysPresent}</td><td className="text-right"><Money v={x.amount} /></td><td className="text-right"><Money v={x.paid} /></td><td className="text-right"><Money v={x.outstanding} /></td></tr>
        ))}</tbody>
        <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={2}>{mn.common.total}</td><td className="text-right"><Money v={r.totals.amount} /></td><td className="text-right"><Money v={r.totals.paid} /></td><td className="text-right"><Money v={r.totals.outstanding} /></td></tr></tfoot>
      </table>
    </div>
  );
}
```

`src/components/MonthPicker.tsx` (GET form, reused by report pages):

```tsx
import { mn } from "@/lib/i18n/mn";
export function MonthPicker({ year, month, extra }: { year: number; month: number; extra?: React.ReactNode }) {
  const years = [year - 1, year, year + 1];
  return (
    <form className="mb-3 flex items-center gap-2 text-sm">
      {extra}
      <select name="year" defaultValue={year} className="rounded border p-1">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
      <select name="month" defaultValue={month} className="rounded border p-1">{mn.months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      <button className="underline">OK</button>
    </form>
  );
}
```

`src/app/teacher/class/[id]/report/page.tsx`:

```tsx
import { requirePage } from "@/lib/page-auth";
import { classFundReport, monthlyFoodReport } from "@/services/reports";
import { FundReportView } from "@/components/FundReport";
import { FoodReportView } from "@/components/FoodReport";
import { MonthPicker } from "@/components/MonthPicker";
import { todayDate } from "@/lib/dates";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const actor = await requirePage("TEACHER");
  const { id } = await params;
  const sp = await searchParams;
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const [fund, food] = await Promise.all([classFundReport(actor, id), monthlyFoodReport(actor, id, year, month)]);
  return (
    <div className="flex flex-col gap-8">
      <FundReportView r={fund} classId={id} />
      <div>
        <MonthPicker year={year} month={month} />
        <FoodReportView r={food} classId={id} />
      </div>
    </div>
  );
}
```

`src/app/accountant/report/page.tsx`:

```tsx
import { requirePage } from "@/lib/page-auth";
import { getActiveSchoolYear } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { monthlyFoodReport } from "@/services/reports";
import { FoodReportView } from "@/components/FoodReport";
import { MonthPicker } from "@/components/MonthPicker";
import { todayDate } from "@/lib/dates";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; year?: string; month?: string }> }) {
  const actor = await requirePage("ACCOUNTANT", "ADMIN");
  const sp = await searchParams;
  const year0 = await getActiveSchoolYear();
  const classes = await listClasses(year0.id);
  const classId = sp.classId ?? classes[0]?.id;
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const picker = (
    <select name="classId" defaultValue={classId} className="rounded border p-1">
      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
  if (!classId) return <p>{mn.schoolYear.noActive}</p>;
  const r = await monthlyFoodReport(actor, classId, year, month);
  return (
    <div>
      <MonthPicker year={year} month={month} extra={picker} />
      <FoodReportView r={r} classId={classId} />
    </div>
  );
}
```

`src/app/admin/classes/[id]/report/page.tsx`:

```tsx
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
```

Add a link to the report from `src/app/admin/classes/[id]/page.tsx` beside the months link:

```tsx
<a href={`/admin/classes/${c.id}/report`} className="text-sm underline">{mn.nav.report}</a>
```

- [ ] **Step 7: Manual check and commit**

As teacher open the report tab, download both CSVs and open one in Excel or Numbers to confirm Cyrillic renders.

```bash
git add -A
git commit -m "feat: class fund and monthly food reports with CSV export"
```

---

### Task 14: Parent pages

**Files:**
- Modify: `src/app/parent/page.tsx` (replace placeholder)
- Create: `src/app/parent/students/[id]/page.tsx`

**Interfaces:**
- Consumes: `listChildren`, `studentBalances`, `listPayments`, `classFundReport`, `getMonthAttendance`, `holidayDates`, `AttendanceGrid`, `StudentBalancesView`, `FundReportView`.

- [ ] **Step 1: Child selector**

Replace `src/app/parent/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { listChildren } from "@/services/students";
import { mn } from "@/lib/i18n/mn";

export default async function ParentHome() {
  const actor = await requirePage("PARENT");
  const children = await listChildren(actor.userId);
  if (children.length === 0) return <p>{mn.parent.noChildren}</p>;
  if (children.length === 1) redirect(`/parent/students/${children[0].id}`);
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{mn.parent.selectChild}</h1>
      <ul className="list-disc pl-6">
        {children.map((s) => (
          <li key={s.id}><Link href={`/parent/students/${s.id}`} className="underline">{s.name} — {s.class.name}</Link></li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Child detail page**

`src/app/parent/students/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { assertStudentAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { studentBalances, listPayments } from "@/services/payments";
import { classFundReport } from "@/services/reports";
import { getMonthAttendance } from "@/services/attendance";
import { holidayDates } from "@/services/holidays";
import { listChildren } from "@/services/students";
import { AttendanceGrid, type GridDay } from "@/components/AttendanceGrid";
import { StudentBalancesView } from "@/components/StudentBalances";
import { FundReportView } from "@/components/FundReport";
import { monthDates, toISODate, todayDate, isFuture } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const actor = await requirePage("PARENT");
  const { id } = await params;
  const sp = await searchParams;
  try {
    await assertStudentAccess(actor, id);
  } catch {
    redirect("/forbidden");
  }
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: { class: true } });
  const t = todayDate();
  const year = Number(sp.year ?? t.getUTCFullYear());
  const month = Number(sp.month ?? t.getUTCMonth() + 1);
  const [b, payments, fund, rows, holidays, children] = await Promise.all([
    studentBalances(actor, id),
    listPayments(actor, id),
    classFundReport(actor, student.classId),
    getMonthAttendance(student.classId, year, month),
    holidayDates(student.class.schoolYearId),
    listChildren(actor.userId),
  ]);
  const days: GridDay[] = monthDates(year, month).map((d) => ({ iso: toISODate(d), day: d.getUTCDate(), weekday: d.getUTCDay(), chargeable: isChargeable(d, holidays), future: isFuture(d) }));
  const initial: Record<string, "PRESENT" | "ABSENT" | null> = {};
  for (const r of rows) if (r.studentId === id) initial[`${id}|${toISODate(r.date)}`] = r.status as "PRESENT" | "ABSENT";
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">{student.name} — {student.class.name}</h1>
        {children.length > 1 && <Link href="/parent" className="text-sm underline">{mn.parent.selectChild}</Link>}
      </div>
      <section>
        <div className="mb-1 flex items-center gap-3 text-sm">
          <Link href={`?year=${prev.y}&month=${prev.m}`} className="underline">←</Link>
          <span className="font-semibold">{mn.attendance.title}: {year} {mn.months[month - 1]}</span>
          <Link href={`?year=${next.y}&month=${next.m}`} className="underline">→</Link>
        </div>
        <AttendanceGrid students={[{ id, name: student.name }]} days={days} initial={initial} readOnly />
      </section>
      <StudentBalancesView b={b} payments={payments} />
      <FundReportView r={fund} classId={student.classId} />
    </div>
  );
}
```

- [ ] **Step 3: Manual check and commit**

Log in as `parent@school.local`: see the child's attendance, invoices, payments and class report; try another student's URL and get the forbidden page.

```bash
git add -A
git commit -m "feat: parent views for attendance, bills, payments and class fund report"
```

---

### Task 15: Admin dashboard

**Files:**
- Modify: `src/app/admin/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: `getActiveSchoolYear`, `listClasses`, `outstandingTable`.

- [ ] **Step 1: Dashboard page**

Replace `src/app/admin/page.tsx`:

```tsx
import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { listSchoolYears } from "@/services/school-years";
import { listClasses } from "@/services/classes";
import { outstandingTable } from "@/services/payments";
import { Money } from "@/components/Money";
import { mn } from "@/lib/i18n/mn";

export default async function AdminHome() {
  const actor = await requirePage("ADMIN");
  const years = await listSchoolYears();
  const active = years.find((y) => y.isActive);
  if (!active) return <p>{mn.schoolYear.noActive} — <Link href="/admin/school-years" className="underline">{mn.schoolYear.create}</Link></p>;
  const [classes, rows] = await Promise.all([listClasses(active.id), outstandingTable(actor)]);
  const byClass = new Map<string, { food: number; fund: number }>();
  for (const r of rows) {
    const t = byClass.get(r.classId) ?? { food: 0, fund: 0 };
    t.food += r.foodDue;
    t.fund += r.fundDue;
    byClass.set(r.classId, t);
  }
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{active.name}</h1>
      <table className="w-full border bg-white text-sm">
        <thead><tr><th className="p-2 text-left">{mn.common.class}</th><th>{mn.common.teacher}</th><th>{mn.nav.students}</th><th>{mn.class.foodOutstanding}</th><th>{mn.class.fundOutstanding}</th><th /></tr></thead>
        <tbody>
          {classes.map((c) => {
            const t = byClass.get(c.id) ?? { food: 0, fund: 0 };
            return (
              <tr key={c.id} className="border-t">
                <td className="p-2"><Link href={`/admin/classes/${c.id}`} className="underline">{c.name}</Link></td>
                <td className="text-center">{c.teacher?.name ?? mn.class.noTeacher}</td>
                <td className="text-center">{c._count.students}</td>
                <td className="text-right"><Money v={t.food} /></td>
                <td className="text-right"><Money v={t.fund} /></td>
                <td className="p-1 text-center"><Link href={`/admin/classes/${c.id}/report`} className="underline">{mn.nav.report}</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Manual check and commit**

As admin, confirm per-class totals match the accountant's outstanding table.

```bash
git add -A
git commit -m "feat: admin dashboard with per-class outstanding totals"
```

---

### Task 16: End-to-end smoke test, build check, README

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `README.md`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", locale: "mn-MN" },
  webServer: {
    command: "DATABASE_URL=file:./e2e.db npx prisma db push --force-reset --skip-generate && DATABASE_URL=file:./e2e.db npm run db:seed && DATABASE_URL=file:./e2e.db npx next dev -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Write the smoke test**

`e2e/smoke.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "changeme");
  await page.click('button:has-text("Нэвтрэх")');
}

async function logout(page: Page) {
  await page.click('button:has-text("Гарах")');
  await expect(page).toHaveURL(/\/login/);
}

test("teacher marks attendance and closes month; accountant pays; parent sees zero due", async ({ page }) => {
  // Use last month so "close month" is allowed regardless of today's date.
  const now = new Date(Date.now() + 8 * 3600_000);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth(); // 0-based previous month
  if (m === 0) { m = 12; y -= 1; }

  await login(page, "teacher@school.local");
  await expect(page).toHaveURL(/\/teacher\/class\//);
  await page.goto(page.url().split("?")[0] + `?year=${y}&month=${m}`);
  // Click the first enabled cell in the first student row.
  const cell = page.locator("tbody tr").first().locator("button:not([disabled])").first();
  await cell.click();
  await expect(cell).toHaveText("И");
  page.once("dialog", (d) => d.accept());
  await page.click('button:has-text("Сар хаах")');
  await expect(page.locator("text=Хаагдсан")).toBeVisible();
  await logout(page);

  await login(page, "accountant@school.local");
  await expect(page).toHaveURL(/\/accountant/);
  const row = page.locator("tbody tr", { hasText: "Батбаяр" });
  const due = (await row.locator("td").nth(2).innerText()).replace(/[^\d]/g, "");
  await row.locator("a").click();
  await page.selectOption('select[name="kind"]', "FOOD");
  await page.fill('input[name="amount"]', due);
  await page.click('button:has-text("Хадгалах")');
  await expect(page.locator("text=Хоолны өр:")).toContainText("0 ₮");
  await logout(page);

  await login(page, "parent@school.local");
  await expect(page).toHaveURL(/\/parent\/students\//);
  await expect(page.locator("text=Хоолны өр:")).toContainText("0 ₮");
});
```

- [ ] **Step 3: Run e2e and build**

Run: `npm run e2e`
Expected: 1 passed.

Run: `npm run build`
Expected: compiles with no type errors. Fix any reported type errors before continuing.

Run: `npm test`
Expected: all unit and service tests pass.

- [ ] **Step 4: README**

`README.md`:

```markdown
# Сургуулийн сан (School Fund)

Teachers mark attendance, the app bills parents monthly for food by days present,
an accountant registers bank payments, and each class tracks an annual fund with a
spending report. UI is in Mongolian; amounts are MNT.

## Run locally

    npm install
    npx prisma db push
    npm run db:seed
    npm run dev

Log in at http://localhost:3000 with `admin@school.local` / `changeme`
(also `teacher@`, `accountant@`, `parent@`). Change these passwords from
Admin → Хэрэглэгчид before real use.

## Tests

    npm test        # unit + service tests (SQLite test.db)
    npm run e2e     # Playwright smoke test (starts its own server on :3100)

## Roles

- Админ: school years, holidays, classes, users, rates, reopen a closed month.
- Багш: own class roster, parents, attendance, close month, expenses, reports.
- Нягтлан: outstanding balances, register and delete payments, monthly food report.
- Эцэг эх: own children's attendance, bills, payments, class fund report.

## Production

Set `DATABASE_URL` to a persistent SQLite file (e.g. `file:/data/school.db`) and
run `npx prisma db push` once. To move to Postgres, change `provider` in
`prisma/schema.prisma` to `postgresql`, set `DATABASE_URL`, and run
`npx prisma migrate dev`. No enum types are used, so the schema ports as is.
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: playwright smoke flow; docs: README"
```
