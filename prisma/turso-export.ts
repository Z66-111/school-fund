// One-time move out of Turso into a plain SQLite file (for a host that keeps the database on its own disk).
//
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:turso-export -- /absolute/path/prod.db
//
// The reverse of turso-copy.ts: rows are re-written through Prisma so dates end up in the format
// the local engine uses (epoch numbers); a raw dump of the Turso tables would keep them as text.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) first.");
const out = process.argv[2];
if (!out || !isAbsolute(out)) throw new Error("Pass the absolute path of the file to create.");
if (existsSync(out)) throw new Error(`${out} already exists; refusing to write over it.`);

const fileUrl = `file:${out}`;
execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: fileUrl }, stdio: "inherit" });

const source = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });
const target = new PrismaClient({ datasourceUrl: fileUrl });

// Parents before children so foreign keys hold. Sessions are skipped: everyone logs in again.
const order = [
  "user", "schoolYear", "holiday", "class", "student", "parentStudent", "attendance", "daycareAttendance", "daycareSkip",
  "monthClose", "foodInvoice", "daycareInvoice", "payment", "expense", "lessonSlot", "periodTime",
] as const;

type Delegate = { findMany: (a: { select: Record<string, true> }) => Promise<object[]>; createMany: (a: { data: object[] }) => Promise<unknown>; count: () => Promise<number> };
const model = (c: PrismaClient, name: (typeof order)[number]) => (c as unknown as Record<string, Delegate>)[name];

async function main() {
  for (const name of order) {
    // A hosted database made by an older version can lack newer tables and columns; read only what
    // is there and let the new file's defaults fill the rest.
    const table = name[0].toUpperCase() + name.slice(1);
    const columns = (await source.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${table}")`)).map((c) => c.name);
    if (columns.length === 0) {
      console.log(`${name}: not in the source, left empty`);
      continue;
    }
    const fields = Prisma.dmmf.datamodel.models.find((m) => m.name === table)!.fields.filter((f) => f.kind !== "object").map((f) => f.name);
    const missing = fields.filter((f) => !columns.includes(f));
    if (missing.length > 0) console.log(`${name}: source has no ${missing.join(", ")}; defaults used`);
    const select = Object.fromEntries(fields.filter((f) => columns.includes(f)).map((f) => [f, true as const]));
    const rows = await model(source, name).findMany({ select });
    for (let i = 0; i < rows.length; i += 200) await model(target, name).createMany({ data: rows.slice(i, i + 200) });
    const written = await model(target, name).count();
    if (written !== rows.length) throw new Error(`${name}: read ${rows.length} rows but the file has ${written}`);
    console.log(`${name}: ${rows.length}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
