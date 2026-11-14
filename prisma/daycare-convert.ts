// One-time conversion of old pay-per-day Өдөр өнжүүлэх records to the prepaid rule.
//
//   npm run db:daycare-convert              # dry run: prints what would change
//   npm run db:daycare-convert -- --apply   # writes the changes
//
// (Set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN to run it against the hosted database.)
//
// Every child is in Өдөр өнжүүлэх by default. For each active child of the active school year who
// is not enrolled yet, this:
//   - with old pay-per-day "stayed" ticks in months still open: enrols the child from their first
//     ticked day and records as skipped every school day from then up to the class's last ticked
//     day that the child was not ticked on;
//   - with no such ticks: enrols the child from the first day of the school year.
// Closed months, already-enrolled children and the old ticks themselves are left untouched, so it
// is safe to run more than once.
import { prisma } from "../src/lib/db";
import { isChargeable } from "../src/lib/billing";
import { toISODate } from "../src/lib/dates";

const apply = process.argv.includes("--apply");
const DAY = 86_400_000;

async function main() {
  const classes = await prisma.class.findMany({
    where: { schoolYear: { isActive: true } },
    select: {
      id: true,
      name: true,
      schoolYear: { select: { name: true, startDate: true, holidays: { select: { date: true } } } },
      monthCloses: { select: { year: true, month: true } },
      students: { where: { daycareFrom: null, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, daycareDays: { select: { date: true } } } },
    },
  });
  let enrolled = 0;
  let skipped = 0;
  for (const c of classes) {
    const closed = new Set(c.monthCloses.map((m) => `${m.year}-${m.month}`));
    const isOpen = (d: Date) => !closed.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
    const holidays = c.schoolYear.holidays.map((h) => h.date);
    if (c.students.length === 0) continue;
    const all = c.students.map((s) => ({ s, days: s.daycareDays.map((r) => r.date).filter(isOpen).sort((a, b) => a.getTime() - b.getTime()) }));
    const ticks = all.filter((x) => x.days.length > 0);
    const frontier = Math.max(0, ...ticks.map((x) => x.days[x.days.length - 1].getTime()));
    console.log(`\n${c.schoolYear.name} / ${c.name}${frontier ? `: ticked up to ${toISODate(new Date(frontier))}` : ""}`);
    for (const { s } of all.filter((x) => x.days.length === 0)) {
      console.log(`  ${s.name}: enrol from ${toISODate(c.schoolYear.startDate)} (start of school year)`);
      enrolled++;
      if (apply) await prisma.student.update({ where: { id: s.id }, data: { daycareFrom: c.schoolYear.startDate } });
    }
    for (const { s, days } of ticks) {
      const stayed = new Set(days.map(toISODate));
      const skips: Date[] = [];
      for (let t = days[0].getTime(); t <= frontier; t += DAY) {
        const d = new Date(t);
        if (isOpen(d) && isChargeable(d, holidays) && !stayed.has(toISODate(d))) skips.push(d);
      }
      console.log(`  ${s.name}: enrol from ${toISODate(days[0])}, ${skips.length} skipped day(s)${skips.length ? ` (${skips.map(toISODate).join(", ")})` : ""}`);
      enrolled++;
      skipped += skips.length;
      if (!apply) continue;
      await prisma.$transaction([
        prisma.student.update({ where: { id: s.id }, data: { daycareFrom: days[0] } }),
        ...skips.map((date) => prisma.daycareSkip.upsert({ where: { studentId_date: { studentId: s.id, date } }, update: {}, create: { studentId: s.id, date } })),
      ]);
    }
  }
  console.log(`\n${apply ? "Applied" : "Dry run"}: ${enrolled} student(s) to enrol, ${skipped} skipped day(s).${apply || enrolled === 0 ? "" : " Re-run with -- --apply to write."}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
