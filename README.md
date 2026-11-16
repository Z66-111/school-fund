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

5. **Domain** — add `angisan.mn` to the project (Vercel: Settings → Domains)
   and point the domain's DNS records where the host tells you.

## Alternative: cPanel (Setup Node.js App)

Needs a host with the **Setup Node.js App** icon (CloudLinux Node.js
Selector + Passenger); plain shared hosting cannot run Next.js. The database
is a SQLite file on the host's own disk, kept outside the app folder and
outside `public_html` (e.g. `/home/<user>/angisan-data/prod.db`) so deploys
never touch it and it cannot be downloaded from the web. Turso is not used.

**The database file**: build it on your own machine and upload it. Coming from
Turso, `npm run db:turso-export -- /absolute/path/prod.db` (with
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set) creates the tables and copies
every row. Starting empty, `DATABASE_URL=file:/absolute/path/prod.db npx prisma db push`
then `npm run db:seed` with the same variable. Back the file up regularly; it
is the only copy of the data.

1. **Build locally** (`npm run build`; shared hosts run out of memory
   building). Zip the project without `node_modules`, `.git`, `test-results`,
   `e2e`, `tests`; keep `.next`, `src`, `public`, `prisma`, `server.js`,
   `package.json`, `package-lock.json`, `next.config.ts`. Upload and extract
   to a folder outside `public_html`, e.g. `/home/<user>/school-fund`.
2. **Create the app**: Node.js 20.9+ (22 if offered), mode *Development* for
   now, application root `school-fund`, startup file `server.js`, URL = your
   domain.
3. **Environment variables**: `DATABASE_URL=file:/home/<user>/angisan-data/prod.db`
   (an absolute path). Leave `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
   unset, or the app talks to Turso instead of the file.
   Also set `APP_ORIGIN` to the site's public address, e.g.
   `https://angisan.mn` (no trailing slash). After a login or a saved form the
   app fetches the next page from its own address; under Passenger it has no
   port of its own, so it needs to be told. Without it the site still works,
   but each login logs a `failed to get redirect response` error.
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

## Өдөр өнжүүлэх (daycare) billing

Daycare is prepaid. A child enrolled on the class's Сурагчид page owes the whole
month from its first day: the class's daily rate × that month's school days.
The teacher marks only the days the child did not stay; each of those days is
deducted, at the daily rate, from the following month's charge.

Moving a database that still has old pay-per-day ticks to this rule:

    npm run db:daycare-convert              # dry run, prints the plan
    npm run db:daycare-convert -- --apply   # enrols those children and records their skipped days

A new Turso database made with `npm run db:turso-copy` already has all of this. Only a hosted
database created before this version needs the schema added by hand first:

    ALTER TABLE "Student" ADD COLUMN "daycareFrom" DATETIME;
    ALTER TABLE "Student" ADD COLUMN "daycareUntil" DATETIME;
    ALTER TABLE "DaycareInvoice" ADD COLUMN "deductedDays" INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE "DaycareSkip" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "studentId" TEXT NOT NULL,
        "date" DATETIME NOT NULL,
        CONSTRAINT "DaycareSkip_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX "DaycareSkip_studentId_date_key" ON "DaycareSkip"("studentId", "date");

## CI/CD (GitLab)

`.gitlab-ci.yml` runs on every push and merge request:

1. **check** — lint, type check and unit tests (`unit`), and the browser tests (`e2e`).
2. **build** — production build, packaged as the cPanel upload (`package/`, kept
   as a downloadable artifact for two weeks).
3. **deploy** — on the default branch only, after the checks pass: uploads the
   package to the cPanel host over FTPS and restarts the app (Passenger
   restarts when `tmp/restart.txt` changes). It keeps `node_modules` and
   everything else already on the host.

The deploy job exists only once these are set under Settings → CI/CD →
Variables (masked and protected):

| Variable | Value |
|---|---|
| `CPANEL_FTP_HOST` | FTP host name only, e.g. `ftp.angisan.mn` or the server's own name. Not the cPanel web address (`https://…:2083`) |
| `CPANEL_FTP_USER` | FTP user |
| `CPANEL_FTP_PASSWORD` | FTP password |
| `CPANEL_APP_DIR` | The app's folder as that FTP user sees it, e.g. `/angisan` for `/home/<user>/angisan`. It must already exist |
| `CPANEL_FTP_VERIFY_CERT` | Optional. `no` only if the host's FTP certificate does not match its name |

The first deployment is still done by hand (create the Node.js app, set its
environment variables, Run NPM Install — see the cPanel section). After that a
push to the default branch deploys. The pipeline cannot run `npm install` on
the host: when `package-lock.json` changes, press **Run NPM Install** for the
app in cPanel and restart it. Database schema changes are also applied by
hand, before the code that needs them.
