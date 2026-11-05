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

## Alternative: cPanel (Setup Node.js App)

Needs a host with the **Setup Node.js App** icon (CloudLinux Node.js
Selector + Passenger); plain shared hosting cannot run Next.js. The database
stays on Turso, so no data move is needed.

1. **Build locally** (`npm run build`; shared hosts run out of memory
   building). Zip the project without `node_modules`, `.git`, `test-results`,
   `e2e`, `tests`; keep `.next`, `src`, `public`, `prisma`, `server.js`,
   `package.json`, `package-lock.json`, `next.config.ts`. Upload and extract
   to a folder outside `public_html`, e.g. `/home/<user>/school-fund`.
2. **Create the app**: Node.js 20.9+ (22 if offered), mode *Development* for
   now, application root `school-fund`, startup file `server.js`, URL = your
   domain.
3. **Environment variables**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
   `DATABASE_URL=file:./unused.db`.
4. **Run NPM Install** while still in Development mode — `postinstall` runs
   `prisma generate`, and the Prisma CLI is a dev dependency, so Production
   mode would skip it and the app fails to start.
5. Switch mode to **Production**, save, **Restart**. Passenger writes the
   `.htaccess` itself.

On every code change: rebuild locally, re-upload `.next` (and changed
sources), restart the app. If `prisma generate` fails with an engine or glibc
error, the host's Linux is too old for Prisma's native engine.

**Later schema changes**: generate the SQL from the previous schema and apply it
with the Turso CLI, e.g.

    git show HEAD~1:prisma/schema.prisma > /tmp/old.prisma
    npx prisma migrate diff --from-schema-datamodel /tmp/old.prisma \
      --to-schema-datamodel prisma/schema.prisma --script > change.sql
    turso db shell school-fund < change.sql
