# School Fund — Design Spec

Date: 2026-10-05
Status: Approved for planning

## 1. Purpose

A web app for one school where teachers record daily attendance per child, the
app computes each child's monthly food bill from days present, parents pay by
bank transfer, and an accountant registers the payments. Each class also has an
annual fund (water, tissue, supplies) that parents pay into and the teacher
spends from; the app tracks contributions and spending and shows a report.

Users: school admin, class teachers, school accountant, parents.
Language: Mongolian UI. Currency: MNT, stored as integer tögrög.

## 2. Roles

| Role | Can do |
|------|--------|
| ADMIN | Create school years, classes, holidays. Create teacher/accountant/parent accounts, reset passwords. Assign teachers to classes. Set per-class daily food rate and annual fund amount. Reopen a closed month. View everything. |
| TEACHER | Manage own class roster. Create or link parent accounts to students. Mark attendance. Close a month. Record expenses. View own class reports. |
| ACCOUNTANT | View all students' outstanding balances. Register and delete (own) payments. View monthly food report for any class. Cannot edit attendance or expenses. |
| PARENT | View own linked children only: attendance, food invoices, annual fund status, payment history, class fund report. Read-only. |

One user has exactly one role. A parent may be linked to several students in
different classes.

## 3. Architecture

- Next.js (App Router, TypeScript), server actions for all mutations.
- Prisma ORM. SQLite in development and tests; Postgres in production via
  `DATABASE_URL`.
- Email + password login with bcrypt hashes. Sessions are rows in a `Session`
  table referenced by a random token in an httpOnly cookie (no Auth.js; fewer
  moving parts for a single-school app). Session resolves to `userId` and `role`.
- Tailwind CSS. Vitest for unit/integration tests. Playwright for one smoke test.
- Single deployable. Target hosts: Vercel + managed Postgres, Railway, or a VPS.

Project layout:

```
src/
  app/                 routes grouped by role: (auth), admin/, teacher/, accountant/, parent/
  lib/
    auth.ts            Auth.js config, session helpers
    authz.ts           requireRole(), canAccessClass(), canAccessStudent()
    db.ts              Prisma client
    money.ts           formatMNT(), parseMNT()
    billing.ts         pure functions: computeInvoice(), allocateFoodPayment(), fundBalance()
    i18n/mn.ts         all UI strings
  actions/             server actions per domain: classes, students, attendance, invoices, payments, expenses, users
  components/
prisma/
  schema.prisma
  seed.ts              one admin, one school year, demo class
tests/
```

Authorization is enforced only on the server. Every server action starts with
`requireRole(...)` and, where a class or student id is involved, a `canAccess*`
check. UI hides what a role cannot do, but hiding is not the security boundary.

## 4. Data model

All money fields are `Int` (MNT). All dates stored as `DateTime` at UTC midnight
for calendar dates. Enum-like fields (role, status, kind) are `String` columns
validated by Zod, because Prisma enums are not portable between SQLite and
Postgres. "Today" is computed in Ulaanbaatar time (UTC+8).

- **User**: id, name, email (unique, stored lowercase), passwordHash, role
  (ADMIN|TEACHER|ACCOUNTANT|PARENT), createdAt.
- **Session**: id (random token), userId, expiresAt.
- **SchoolYear**: id, name, startDate, endDate, isActive. Exactly one active at
  a time (enforced in the action that activates).
- **Holiday**: id, schoolYearId, date, name. Non-charged, greyed in grid.
- **Class**: id, name, schoolYearId, teacherId (nullable User), dailyFoodRate
  Int, annualFundAmount Int. Unique (schoolYearId, name).
- **Student**: id, classId, name, isActive (default true).
- **ParentStudent**: parentUserId, studentId. Composite PK.
- **Attendance**: id, studentId, date, status enum (PRESENT|ABSENT).
  Unique (studentId, date). Absence of a row means "unmarked" and is treated as
  ABSENT for billing.
- **MonthClose**: id, classId, year, month, closedAt, closedById. Unique
  (classId, year, month). Presence means the month is closed for that class.
- **FoodInvoice**: id, studentId, monthCloseId, year, month, daysPresent,
  rate, amount (= daysPresent × rate), createdAt. Unique (studentId, year, month).
- **Payment**: id, studentId, kind enum (FOOD|ANNUAL_FUND), amount, paidAt,
  note, registeredById, createdAt, deletedAt (nullable), deleteReason
  (nullable). Food payments are not linked to a single invoice; allocation is
  computed (see §5). Rows with deletedAt set are excluded from every sum.
- **Expense**: id, classId, schoolYearId, date, title, amount, note,
  createdById, createdAt.

Derived values (never stored):

- Food outstanding (student) = Σ FoodInvoice.amount − Σ Payment(FOOD).amount.
  Floor at 0 for display; a negative value is shown as "credit".
- Annual fund due (student) = Class.annualFundAmount − Σ Payment(ANNUAL_FUND).
- Class fund collected = Σ Payment(ANNUAL_FUND) over students in class.
- Class fund spent = Σ Expense.amount for class + active school year.
- Class fund balance = collected − spent.

## 5. Key flows and rules

### 5.1 Setup (admin)
Create school year → create class with rate and fund amount → create users →
assign teacher. Admin can set any user's password.

### 5.2 Roster (teacher)
Add students. For each student: create a parent account (name, email,
temporary password shown once) or link an existing parent by email.
Students with any invoice or payment cannot be deleted; they are deactivated.
Inactive students are excluded from new invoices and from the grid by default.

### 5.3 Attendance (teacher)
Month grid: students × days. Weekends and holidays are disabled and never
charged. Clicking a cell cycles unmarked → PRESENT → ABSENT → unmarked.
Bulk action: "mark all present today". Grid is read-only once the month is
closed for that class. Future dates cannot be marked.

### 5.4 Close month (teacher)
Button on the attendance grid. Preconditions: month not already closed, month
is current or past. Action, in one transaction: create MonthClose; for each
active student create FoodInvoice with daysPresent = count of PRESENT rows in
that month, rate = Class.dailyFoodRate at close time, amount = product.
Students with zero days still get a zero invoice (so the report is complete).

### 5.5 Reopen month (admin)
Allowed only if no non-deleted FOOD payment for any student in that class has
createdAt later than MonthClose.closedAt. Deletes the month's invoices and the
MonthClose in one transaction. Attendance rows are kept.

### 5.6 Register payment (accountant)
Outstanding table: all active students, columns class, student, food due,
fund due; filter by class; sort by amount. Register form: student, kind,
amount (> 0, integer), paidAt (date, not future), note (bank reference).
Display-only allocation: food payments apply to oldest invoice first when
showing per-invoice paid/unpaid status. Accountant may delete a payment they
registered; a reason is required and stored in an audit note on deletion (soft
delete: `deletedAt`, `deleteReason`). Deleted payments are excluded from all
sums.

### 5.7 Expenses (teacher)
Add: date (not future), title, amount (> 0), note. Edit/delete own class's
expenses in the active school year.

### 5.8 Parent view
Child selector when linked to >1 student. Shows: current month attendance
(read-only grid row), list of food invoices with per-invoice paid/outstanding,
annual fund paid vs due, payment history, class fund report.

## 6. Screens

- `/login`
- `/admin` dashboard: school year selector; links to classes, users, holidays;
  per-class outstanding totals.
- `/admin/classes`, `/admin/classes/[id]`, `/admin/users`, `/admin/holidays`,
  `/admin/school-years`
- `/teacher` → redirects to `/teacher/class/[id]` (their class)
- `/teacher/class/[id]/attendance?year=&month=`
- `/teacher/class/[id]/students`
- `/teacher/class/[id]/expenses`
- `/teacher/class/[id]/report`
- `/accountant` outstanding table
- `/accountant/students/[id]` invoices, payments, register form
- `/accountant/payments` log with delete
- `/accountant/report?classId=&year=&month=` monthly food report
- `/parent` child selector or single child view
- `/parent/students/[id]`

## 7. Reports

- **Class fund report**: collected, spent, balance; expenses by date;
  contributions per student (paid, due). Visible to teacher (own class),
  admin, parent (child's class).
- **Monthly food report**: per student days present, invoice amount, paid,
  outstanding, for one class and month. Visible to teacher, admin, accountant.
- Both have a CSV export button (UTF-8 with BOM so Excel opens Cyrillic).

## 8. Validation and errors

- All server action inputs validated with Zod; field errors returned and
  rendered beside fields.
- Money: positive integer only; reject decimals and negatives.
- Unauthorized: server action throws; page shows a plain "Хандах эрхгүй" page.
- Closing an already closed month, marking future dates, editing a closed
  month, deleting a student with records, reopening a month with later
  payments: each returns a specific Mongolian error message.

## 9. Testing

- Unit (Vitest): `billing.ts` — invoice computation incl. holidays/weekends
  and unmarked=absent; payment allocation oldest-first; fund balance; money
  parse/format.
- Integration (Vitest + SQLite file per run): every server action's
  authorization matrix (each role × allowed/denied), close month transaction,
  reopen guard, soft-delete exclusion.
- E2E (Playwright, one spec): login as teacher, mark attendance, close month,
  login as accountant, register payment, login as parent, see outstanding 0.

## 10. Out of scope (v1)

Email sending, bank integration, PDF export, mobile app, multiple schools,
half-days or excused absences, per-student rate overrides, English UI.

## 11. Seed and local run

`npm run dev` with SQLite. `prisma db seed` creates: admin
(admin@school.local / changeme), active school year, class "1А" with rate
3000 and fund 50000, one teacher, one accountant, two students with one parent.
