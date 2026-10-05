# Lesson Schedule — Design Spec

Date: 2026-10-05
Status: Approved for planning
Builds on: `2026-10-05-school-fund-design.md` (roles, authz, UI conventions)

## 1. Purpose

A weekly timetable per class. The class teacher fills a Monday–Friday ×
period grid with subject names; admin can edit any class; parents see their
child's class timetable read-only. Informational only: it does not affect
attendance or billing.

## 2. Roles

| Role | Can do |
|------|--------|
| TEACHER | View and edit own class's timetable and period times. |
| ADMIN | View and edit any class's timetable. |
| PARENT | View the timetable of each linked child's class. |
| ACCOUNTANT | No access to timetable pages (not needed; `assertClassAccess` would allow reads, but no page links it). |

## 3. Data model

Enum-like values stay `Int`/`String` (no Prisma enums).

- **LessonSlot**: id, classId, weekday `Int` (1 = Monday … 5 = Friday),
  period `Int` (1..8), subject `String` (1..60 chars, trimmed), note
  `String` default "" (0..60 chars). Unique (classId, weekday, period).
  A slot row exists only when `subject` is non-empty.
- **PeriodTime**: id, classId, period `Int` (1..8), startTime `String?`,
  endTime `String?` in "HH:MM" 24-hour form. Unique (classId, period).
  A row exists only when at least one time is set.

Constants: `WEEKDAYS = 5`, `PERIODS = 8`.

## 4. Service (`src/services/schedule.ts`)

- `getSchedule(actor, classId): Promise<Schedule>` — any role passing
  `assertClassAccess`. Returns
  `{ periods: { period, startTime, endTime }[] (always 8, missing → null),
     slots: Record<"${weekday}-${period}", { subject, note }> }`.
- `saveSchedule(actor, classId, input): Promise<void>` —
  `requireRole(actor, "TEACHER", "ADMIN")` then `assertClassAccess`.
  Input is the flat form object; keys `s-{weekday}-{period}` (subject),
  `n-{weekday}-{period}` (note), `start-{period}`, `end-{period}`.
  Validation (Zod): subject/note trimmed, lengths as above; times either
  empty or `/^([01]\d|2[0-3]):[0-5]\d$/`; `endTime` must be after
  `startTime` when both set (field error on `end-{period}`). Unknown keys
  are ignored. In ONE transaction: delete all the class's slots and period
  times, then create rows for non-empty cells. (Replace-all is simplest and
  the grid is small: ≤ 40 slots + 8 periods.)

## 5. Screens

- `/teacher/class/[id]/schedule` — new tab "Хичээлийн хуваарь" on the class
  layout. One `ActionForm` wrapping a table: header row Mon–Fri; one row per
  period 1..8 with the period number, two time inputs (start, end), and per
  weekday a subject input plus a smaller note input. Single Save button.
  Gated by `requireClassPage(id, "TEACHER", "ADMIN")`; both roles may edit.
- Parent child page: a read-only "Хичээлийн хуваарь" section after the
  attendance section, rendered by a shared `ScheduleView` component that
  hides period rows that have neither a subject nor a time. Shows
  "Бүртгэл байхгүй" when the whole grid is empty.
- All strings in `mn.ts` under `schedule.*` and `nav.schedule`.

## 6. Validation and errors

Field errors returned through `ValidationError` as elsewhere; the action
shows them via `ActionForm`. Invalid time → `mn.errors.invalidTime`.
End before start → `mn.errors.endBeforeStart`.

## 7. Testing

Vitest service tests: teacher edits own class, other teacher forbidden,
accountant forbidden, admin allowed, parent can read own child's class and
not another, replace-all semantics (clearing a subject removes the row),
time validation (bad format, end before start), `getSchedule` returns all 8
periods in order with nulls.

## 8. Out of scope

Subject catalogue, rooms, Saturday, per-lesson attendance, printing/CSV,
copying a timetable between classes.
