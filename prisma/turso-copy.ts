// One-time move of the local SQLite database (DATABASE_URL) into an empty Turso database.
//
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:turso-copy
//
// Rows are re-written through the libSQL adapter rather than uploading the .db file, because the
// adapter stores DateTime as ISO text while the local engine stores epoch numbers; mixing the two
// in one table breaks date range queries and the per-day unique keys.
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) first.");

const source = new PrismaClient(); // local file from DATABASE_URL
const target = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });

// Parents before children so foreign keys hold. Sessions are skipped: everyone logs in again.
const order = [
  "user", "schoolYear", "holiday", "class", "student", "parentStudent", "attendance", "daycareAttendance", "daycareSkip",
  "monthClose", "foodInvoice", "daycareInvoice", "payment", "expense", "lessonSlot", "periodTime",
] as const;

type Delegate = { findMany: () => Promise<object[]>; createMany: (a: { data: object[] }) => Promise<unknown>; count: () => Promise<number> };
const model = (c: PrismaClient, name: (typeof order)[number]) => (c as unknown as Record<string, Delegate>)[name];

async function main() {
  const tables = await target.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'");
  if (tables.length === 0) {
    const sql = execFileSync("npx", ["prisma", "migrate", "diff", "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" });
    const statements = sql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);
    for (const s of statements) await target.$executeRawUnsafe(s);
    console.log(`Created schema (${statements.length} statements).`);
  } else if ((await model(target, "user").count()) > 0) {
    throw new Error("Turso database already has users; refusing to copy over existing data.");
  }

  for (const name of order) {
    const rows = await model(source, name).findMany();
    for (let i = 0; i < rows.length; i += 200) await model(target, name).createMany({ data: rows.slice(i, i + 200) });
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
