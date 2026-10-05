import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export default async function () {
  // test.db is a gitignored scratch file owned by the test suite; recreate it from the schema.
  // Prisma resolves a relative sqlite path against the schema directory (prisma/).
  for (const f of ["prisma/test.db", "prisma/test.db-journal", "test.db", "test.db-journal"]) rmSync(f, { force: true });
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
