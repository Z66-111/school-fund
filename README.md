# Сургуулийн сан (School Fund)

Teachers mark attendance, the app bills parents monthly for food by days present,
an accountant registers bank payments, and each class tracks an annual fund with a
spending report. UI is in Mongolian; amounts are MNT.

## Run locally

    npm install
    cp .env.example .env
    npx prisma db push
    npm run db:seed
    npm run dev

`.env` is not committed; `cp .env.example .env` creates it with a local SQLite `DATABASE_URL`.

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
