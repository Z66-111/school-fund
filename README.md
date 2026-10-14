# Сургуулийн хуримтлал (School Fund)

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

## Production (Vercel + Turso, free tiers)

The app runs on Vercel; the database is Turso (hosted SQLite). When
`TURSO_DATABASE_URL` is set the app uses Turso, otherwise the local file
(`src/lib/db.ts`).

1. **Turso database** — sign up at turso.tech, then with the Turso CLI:

       turso auth login
       turso db locations                      # pick the closest region
       turso db create school-fund --location <region>
       turso db show --url school-fund         # -> TURSO_DATABASE_URL
       turso db tokens create school-fund      # -> TURSO_AUTH_TOKEN

2. **Copy the local data in** (creates the tables, then copies every row):

       TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run db:turso-copy

   Do not upload `dev.db` directly (`turso db create --from-file`): the local
   engine stores dates as numbers and the app on Turso stores them as text,
   and mixing both breaks month filters.

3. **Vercel** — push this repo to GitHub, then on vercel.com: Add New →
   Project → import the repo. Under Environment Variables set
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `DATABASE_URL="file:./unused.db"`
   (required by the Prisma schema, not used). Deploy. The site is at
   `https://<project>.vercel.app`.

4. **Before sharing the link**, log in as admin and change every `changeme`
   password (Admin → Хэрэглэгчид).

**Later schema changes**: generate the SQL from the previous schema and apply it
with the Turso CLI, e.g.

    git show HEAD~1:prisma/schema.prisma > /tmp/old.prisma
    npx prisma migrate diff --from-schema-datamodel /tmp/old.prisma \
      --to-schema-datamodel prisma/schema.prisma --script > change.sql
    turso db shell school-fund < change.sql
