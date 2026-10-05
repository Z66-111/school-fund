# Lesson Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weekly Monday–Friday × 8-period timetable per class, edited by the class teacher or admin, viewed read-only by parents.

**Architecture:** One Prisma pair (`LessonSlot`, `PeriodTime`), one service (`src/services/schedule.ts`) with replace-all save in a transaction, one server action, a shared `ScheduleView` for read-only display, a teacher tab page with a single whole-grid form, and a read-only section on the parent child page.

**Tech Stack:** Existing stack (Next.js 16, Prisma 6 SQLite, Zod 3, Vitest, Tailwind tokens from `globals.css`, UI primitives in `src/components/ui/`).

**Spec:** `docs/superpowers/specs/2026-10-05-lesson-schedule-design.md`

## Global Constraints

- All UI strings come from `src/lib/i18n/mn.ts` (add `schedule.*`, `nav.schedule`, `errors.invalidTime`, `errors.endBeforeStart`).
- No Prisma enums; weekday and period are `Int`, times are `String` "HH:MM".
- Service functions take `actor` first; `saveSchedule` starts with `requireRole(actor, "TEACHER", "ADMIN")` then `assertClassAccess`; `getSchedule` uses `assertClassAccess` only.
- Every new `page.tsx` begins with `requireClassPage(...)`/`requirePage(...)` (the scan test `tests/unit/page-auth-scan.test.ts` enforces it).
- Never use `prisma db push --force-reset`; run `npx prisma db push` for the schema change.
- Use the design system: `Table`/`.ledger`, `.input`, `Card`, `PageHeader`, `buttonClass`; no hard-coded colors.
- `WEEKDAYS = 5`, `PERIODS = 8`.

## Review Focus

1. **A cleared cell must disappear** — after saving with an empty subject, no `LessonSlot` row remains (test in Task 1).
2. **Note without subject** — a note typed into a cell with an empty subject is dropped silently, not saved (test in Task 1).
3. **Times only, no subjects** — period times save even when the whole grid of subjects is empty (test in Task 1).
4. **Parent of another class** — cannot read the timetable (test in Task 1).
5. **Garbage form keys** — unknown keys in the form object are ignored rather than failing validation (test in Task 1).

---

### Task 1: Schema, strings, service with tests

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/i18n/mn.ts`
- Create: `src/services/schedule.ts`
- Test: `tests/services/schedule.test.ts`

**Interfaces:**
- Produces: `WEEKDAYS`, `PERIODS`, `type Schedule = { periods: { period: number; startTime: string | null; endTime: string | null }[]; slots: Record<string, { subject: string; note: string }> }`, `slotKey(weekday, period): string`, `getSchedule(actor, classId): Promise<Schedule>`, `saveSchedule(actor, classId, input: Record<string, string>): Promise<void>`.

- [ ] **Step 1: Schema**

Append to `prisma/schema.prisma` and add the two relation arrays to `Class` (`lessonSlots LessonSlot[]`, `periodTimes PeriodTime[]`):

```prisma
model LessonSlot {
  id      String @id @default(cuid())
  classId String
  class   Class  @relation(fields: [classId], references: [id], onDelete: Cascade)
  weekday Int
  period  Int
  subject String
  note    String @default("")

  @@unique([classId, weekday, period])
}

model PeriodTime {
  id        String  @id @default(cuid())
  classId   String
  class     Class   @relation(fields: [classId], references: [id], onDelete: Cascade)
  period    Int
  startTime String?
  endTime   String?

  @@unique([classId, period])
}
```

Run: `npx prisma db push && npx prisma generate`. Add `prisma.lessonSlot.deleteMany()` and `prisma.periodTime.deleteMany()` at the top of the `$transaction` list in `tests/helpers/db.ts` `resetDb()`.

- [ ] **Step 2: Strings**

In `mn.ts` add `schedule: "Хичээлийн хуваарь"` to `nav`, and a new block:

```ts
  schedule: {
    title: "Хичээлийн хуваарь",
    period: "Цаг",
    start: "Эхлэх",
    end: "Дуусах",
    subject: "Хичээл",
    note: "Тэмдэглэл",
    save: "Хуваарь хадгалах",
    saved: "Хуваарь хадгалагдлаа",
    weekdays: ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан"],
  },
```

and to `errors`: `invalidTime: "Цаг буруу (ЦЦ:ММ)"`, `endBeforeStart: "Дуусах цаг эхлэх цагаас хойш байх ёстой"`.

- [ ] **Step 3: Failing tests**

`tests/services/schedule.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getSchedule, saveSchedule, slotKey, PERIODS } from "@/services/schedule";
import { prisma } from "@/lib/db";
import { f, actorOf } from "../helpers/db";

async function setup() {
  const t = await f.user("TEACHER");
  const c = await f.klass({ teacherId: t.id });
  return { t, c, actor: actorOf(t) };
}

describe("saveSchedule", () => {
  it("teacher saves subjects and times for own class; getSchedule returns 8 periods in order", async () => {
    const { c, actor } = await setup();
    await saveSchedule(actor, c.id, { "s-1-1": "Математик", "n-1-1": "201", "s-5-8": "Спорт", "start-1": "08:00", "end-1": "08:40", junk: "x" });
    const s = await getSchedule(actor, c.id);
    expect(s.periods).toHaveLength(PERIODS);
    expect(s.periods.map((p) => p.period)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(s.periods[0]).toEqual({ period: 1, startTime: "08:00", endTime: "08:40" });
    expect(s.periods[1]).toEqual({ period: 2, startTime: null, endTime: null });
    expect(s.slots[slotKey(1, 1)]).toEqual({ subject: "Математик", note: "201" });
    expect(s.slots[slotKey(5, 8)]).toEqual({ subject: "Спорт", note: "" });
    expect(Object.keys(s.slots)).toHaveLength(2);
  });
  it("replace-all: clearing a subject removes its row; a note without subject is dropped; times save alone", async () => {
    const { c, actor } = await setup();
    await saveSchedule(actor, c.id, { "s-1-1": "Математик", "s-2-2": "Монгол хэл" });
    await saveSchedule(actor, c.id, { "s-1-1": "", "n-1-1": "orphan note", "s-2-2": "Монгол хэл", "start-3": "10:00" });
    expect(await prisma.lessonSlot.count({ where: { classId: c.id } })).toBe(1);
    const s = await getSchedule(actor, c.id);
    expect(s.slots[slotKey(1, 1)]).toBeUndefined();
    expect(s.periods[2]).toEqual({ period: 3, startTime: "10:00", endTime: null });
    await saveSchedule(actor, c.id, { "start-1": "08:00", "end-1": "08:40" });
    expect(await prisma.lessonSlot.count({ where: { classId: c.id } })).toBe(0);
    expect(await prisma.periodTime.count({ where: { classId: c.id } })).toBe(1);
  });
  it("rejects bad time format, end before start, and over-long subject", async () => {
    const { c, actor } = await setup();
    await expect(saveSchedule(actor, c.id, { "start-1": "8:00" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveSchedule(actor, c.id, { "start-1": "09:00", "end-1": "08:30" })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { "end-1": expect.any(Array) } });
    await expect(saveSchedule(actor, c.id, { "s-1-1": "x".repeat(61) })).rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("authorization: other teacher and accountant forbidden; admin allowed; parent reads own child's class only", async () => {
    const { c, actor } = await setup();
    await saveSchedule(actor, c.id, { "s-1-1": "Математик" });
    const t2 = await f.user("TEACHER");
    await expect(saveSchedule(actorOf(t2), c.id, { "s-1-1": "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const acc = await f.user("ACCOUNTANT");
    await expect(saveSchedule(actorOf(acc), c.id, { "s-1-1": "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = await f.user("ADMIN");
    await expect(saveSchedule(actorOf(admin), c.id, { "s-1-2": "Түүх" })).resolves.toBeUndefined();
    const p = await f.user("PARENT");
    const s = await f.student(c.id);
    await f.link(p.id, s.id);
    expect((await getSchedule(actorOf(p), c.id)).slots[slotKey(1, 2)]?.subject).toBe("Түүх");
    const other = await f.klass();
    await expect(getSchedule(actorOf(p), other.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveSchedule(actorOf(p), c.id, { "s-1-1": "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
```

Run: `npm test -- tests/services/schedule.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement**

`src/services/schedule.ts`:

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { ValidationError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export const WEEKDAYS = 5;
export const PERIODS = 8;

export type Schedule = {
  periods: { period: number; startTime: string | null; endTime: string | null }[];
  slots: Record<string, { subject: string; note: string }>;
};

export const slotKey = (weekday: number, period: number) => `${weekday}-${period}`;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeSchema = z.string().trim().refine((v) => v === "" || TIME.test(v), { message: mn.errors.invalidTime });
const textSchema = (max: number) => z.string().trim().max(max, mn.errors.validation);

export async function getSchedule(actor: Actor, classId: string): Promise<Schedule> {
  await assertClassAccess(actor, classId);
  const [slots, times] = await Promise.all([
    prisma.lessonSlot.findMany({ where: { classId } }),
    prisma.periodTime.findMany({ where: { classId } }),
  ]);
  const byPeriod = new Map(times.map((t) => [t.period, t]));
  return {
    periods: Array.from({ length: PERIODS }, (_, i) => {
      const t = byPeriod.get(i + 1);
      return { period: i + 1, startTime: t?.startTime ?? null, endTime: t?.endTime ?? null };
    }),
    slots: Object.fromEntries(slots.map((s) => [slotKey(s.weekday, s.period), { subject: s.subject, note: s.note }])),
  };
}

export async function saveSchedule(actor: Actor, classId: string, input: Record<string, string>): Promise<void> {
  requireRole(actor, "TEACHER", "ADMIN");
  await assertClassAccess(actor, classId);

  const fieldErrors: Record<string, string[]> = {};
  const fail = (key: string, msg: string) => ((fieldErrors[key] ??= []).push(msg));

  const slots: { weekday: number; period: number; subject: string; note: string }[] = [];
  for (let w = 1; w <= WEEKDAYS; w++) {
    for (let p = 1; p <= PERIODS; p++) {
      const subj = textSchema(60).safeParse(input[`s-${w}-${p}`] ?? "");
      const note = textSchema(60).safeParse(input[`n-${w}-${p}`] ?? "");
      if (!subj.success) { fail(`s-${w}-${p}`, mn.errors.validation); continue; }
      if (!note.success) { fail(`n-${w}-${p}`, mn.errors.validation); continue; }
      if (subj.data) slots.push({ weekday: w, period: p, subject: subj.data, note: note.data });
    }
  }

  const times: { period: number; startTime: string | null; endTime: string | null }[] = [];
  for (let p = 1; p <= PERIODS; p++) {
    const start = timeSchema.safeParse(input[`start-${p}`] ?? "");
    const end = timeSchema.safeParse(input[`end-${p}`] ?? "");
    if (!start.success) fail(`start-${p}`, mn.errors.invalidTime);
    if (!end.success) fail(`end-${p}`, mn.errors.invalidTime);
    if (!start.success || !end.success) continue;
    if (start.data && end.data && end.data <= start.data) { fail(`end-${p}`, mn.errors.endBeforeStart); continue; }
    if (start.data || end.data) times.push({ period: p, startTime: start.data || null, endTime: end.data || null });
  }

  if (Object.keys(fieldErrors).length) throw new ValidationError(fieldErrors);

  await prisma.$transaction([
    prisma.lessonSlot.deleteMany({ where: { classId } }),
    prisma.periodTime.deleteMany({ where: { classId } }),
    ...slots.map((s) => prisma.lessonSlot.create({ data: { classId, ...s } })),
    ...times.map((t) => prisma.periodTime.create({ data: { classId, ...t } })),
  ]);
}
```

Run: `npm test -- tests/services/schedule.test.ts` → PASS. Then `npm test` (all), `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(schedule): lesson slot and period time models, schedule service"
```

---

### Task 2: Action, shared view, teacher page and tab

**Files:**
- Create: `src/actions/schedule.ts`, `src/components/ScheduleView.tsx`, `src/app/teacher/class/[id]/schedule/page.tsx`
- Modify: `src/app/teacher/class/[id]/layout.tsx` (add tab)

**Interfaces:**
- Consumes: `getSchedule`, `saveSchedule`, `Schedule`, `slotKey`, `WEEKDAYS`, `PERIODS`, `runAction`, `ActionForm`, `requireClassPage`, `Table`, `buttonClass`, `PageHeader`.
- Produces: `saveScheduleAction(prev, fd)`, `ScheduleView({ s })` (read-only), `ScheduleEditor({ s, classId })` (server component rendering the form).

- [ ] **Step 1: Action**

`src/actions/schedule.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action";
import { saveSchedule } from "@/services/schedule";
import { mn } from "@/lib/i18n/mn";

export async function saveScheduleAction(_p: ActionResult | null, fd: FormData) {
  return runAction(fd, async (actor, d) => {
    await saveSchedule(actor, d.classId, d);
    revalidatePath(`/teacher/class/${d.classId}/schedule`);
    return mn.schedule.saved;
  });
}
```

- [ ] **Step 2: Read-only view**

`src/components/ScheduleView.tsx`:

```tsx
import { Table } from "@/components/ui/Table";
import { slotKey, WEEKDAYS, type Schedule } from "@/services/schedule";
import { mn } from "@/lib/i18n/mn";

export function ScheduleView({ s }: { s: Schedule }) {
  const days = Array.from({ length: WEEKDAYS }, (_, i) => i + 1);
  const rows = s.periods.filter((p) => p.startTime || p.endTime || days.some((d) => s.slots[slotKey(d, p.period)]));
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{mn.common.empty}</p>;
  return (
    <Table>
      <thead>
        <tr>
          <th className="ctr">{mn.schedule.period}</th>
          {days.map((d) => <th key={d}>{mn.schedule.weekdays[d - 1]}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.period}>
            <td className="ctr whitespace-nowrap">
              <span className="num font-semibold">{p.period}</span>
              {(p.startTime || p.endTime) && <span className="num block text-xs text-ink-muted">{p.startTime ?? ""}–{p.endTime ?? ""}</span>}
            </td>
            {days.map((d) => {
              const slot = s.slots[slotKey(d, p.period)];
              return (
                <td key={d}>
                  {slot ? (<><span className="font-medium">{slot.subject}</span>{slot.note && <span className="block text-xs text-ink-muted">{slot.note}</span>}</>) : <span className="text-ink-muted">{mn.common.none}</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
```

- [ ] **Step 3: Teacher page**

`src/app/teacher/class/[id]/schedule/page.tsx`:

```tsx
import { requireClassPage } from "@/lib/page-auth";
import { getSchedule, slotKey, WEEKDAYS } from "@/services/schedule";
import { saveScheduleAction } from "@/actions/schedule";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const s = await getSchedule(actor, id);
  const days = Array.from({ length: WEEKDAYS }, (_, i) => i + 1);
  return (
    <ActionForm action={saveScheduleAction} submitLabel={mn.schedule.save} className="flex flex-col gap-4">
      <input type="hidden" name="classId" value={id} />
      <div className="overflow-x-auto rounded-md border border-rule bg-surface">
        <table className="ledger min-w-max">
          <thead>
            <tr>
              <th className="ctr">{mn.schedule.period}</th>
              <th>{mn.schedule.start}</th>
              <th>{mn.schedule.end}</th>
              {days.map((d) => <th key={d}>{mn.schedule.weekdays[d - 1]}</th>)}
            </tr>
          </thead>
          <tbody>
            {s.periods.map((p) => (
              <tr key={p.period}>
                <td className="ctr num font-semibold">{p.period}</td>
                <td><input name={`start-${p.period}`} defaultValue={p.startTime ?? ""} placeholder="08:00" inputMode="numeric" className="input w-20" aria-label={`${mn.schedule.start} ${p.period}`} /></td>
                <td><input name={`end-${p.period}`} defaultValue={p.endTime ?? ""} placeholder="08:40" inputMode="numeric" className="input w-20" aria-label={`${mn.schedule.end} ${p.period}`} /></td>
                {days.map((d) => {
                  const k = slotKey(d, p.period);
                  const slot = s.slots[k];
                  return (
                    <td key={d} className="min-w-40">
                      <input name={`s-${k}`} defaultValue={slot?.subject ?? ""} maxLength={60} placeholder={mn.schedule.subject} className="input" aria-label={`${mn.schedule.weekdays[d - 1]} ${p.period} ${mn.schedule.subject}`} />
                      <input name={`n-${k}`} defaultValue={slot?.note ?? ""} maxLength={60} placeholder={mn.schedule.note} className="input mt-1 text-xs" aria-label={`${mn.schedule.weekdays[d - 1]} ${p.period} ${mn.schedule.note}`} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ActionForm>
  );
}
```

Note the form field names `s-${weekday}-${period}` match the service keys because `slotKey` is `${weekday}-${period}`.

- [ ] **Step 4: Tab**

In `src/app/teacher/class/[id]/layout.tsx` add `{ href: \`${base}/schedule\`, label: mn.nav.schedule }` after the report tab.

- [ ] **Step 5: Verify and commit**

`npx tsc --noEmit`, `npm run lint`, `npm test` (page-auth scan must still pass). Manual: as teacher open the new tab, fill a few cells and times, save, see the success message, reload.

```bash
git add -A && git commit -m "feat(schedule): teacher timetable editor and class tab"
```

---

### Task 3: Parent view, e2e check, final verification

**Files:**
- Modify: `src/app/parent/students/[id]/page.tsx`

- [ ] **Step 1: Parent section**

Import `getSchedule` and `ScheduleView`; add `getSchedule(actor, student.classId)` to the existing `Promise.all` (as `schedule`); render after the attendance section:

```tsx
<section className="flex flex-col gap-3">
  <h2>{mn.schedule.title}</h2>
  <ScheduleView s={schedule} />
</section>
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, then stop any running dev server and `npm run e2e` (restart the dev server afterwards if it was running). Screenshot the teacher editor and the parent view at 1280 and 390 px and check them by eye.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(schedule): parent read-only timetable"
```
