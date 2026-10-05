import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { assertStudentAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { studentBalances, listPayments } from "@/services/payments";
import { classFundReport } from "@/services/reports";
import { getMonthAttendance } from "@/services/attendance";
import { holidayDates } from "@/services/holidays";
import { listChildren } from "@/services/students";
import { AttendanceGrid, type GridDay } from "@/components/AttendanceGrid";
import { StudentBalancesView } from "@/components/StudentBalances";
import { FundReportView } from "@/components/FundReport";
import { monthDates, toISODate, todayDate, isFuture } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const actor = await requirePage("PARENT");
  const { id } = await params;
  const sp = await searchParams;
  let allowed = true;
  try {
    await assertStudentAccess(actor, id);
  } catch {
    allowed = false;
  }
  if (!allowed) redirect("/forbidden");
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: { class: true } });
  const t = todayDate();
  let year = Number(sp.year ?? t.getUTCFullYear());
  let month = Number(sp.month ?? t.getUTCMonth() + 1);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    year = t.getUTCFullYear();
    month = t.getUTCMonth() + 1;
  }
  const [b, payments, fund, rows, holidays, children] = await Promise.all([
    studentBalances(actor, id),
    listPayments(actor, id),
    classFundReport(actor, student.classId),
    getMonthAttendance(student.classId, year, month),
    holidayDates(student.class.schoolYearId),
    listChildren(actor.userId),
  ]);
  const days: GridDay[] = monthDates(year, month).map((d) => ({ iso: toISODate(d), day: d.getUTCDate(), weekday: d.getUTCDay(), chargeable: isChargeable(d, holidays), future: isFuture(d) }));
  const initial: Record<string, "PRESENT" | "ABSENT" | null> = {};
  for (const r of rows) if (r.studentId === id) initial[`${id}|${toISODate(r.date)}`] = r.status as "PRESENT" | "ABSENT";
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">{student.name} — {student.class.name}</h1>
        {children.length > 1 && <Link href="/parent" className="text-sm underline">{mn.parent.selectChild}</Link>}
      </div>
      <section>
        <div className="mb-1 flex items-center gap-3 text-sm">
          <Link href={`?year=${prev.y}&month=${prev.m}`} className="underline">←</Link>
          <span className="font-semibold">{mn.attendance.title}: {year} {mn.months[month - 1]}</span>
          <Link href={`?year=${next.y}&month=${next.m}`} className="underline">→</Link>
        </div>
        <AttendanceGrid key={`${year}-${month}`} students={[{ id, name: student.name }]} days={days} initial={initial} readOnly />
      </section>
      <StudentBalancesView b={b} payments={payments} />
      <FundReportView r={fund} classId={student.classId} />
    </div>
  );
}
