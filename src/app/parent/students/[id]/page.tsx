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
import { MonthNav } from "@/components/MonthNav";
import { StudentBalancesView } from "@/components/StudentBalances";
import { FundReportView } from "@/components/FundReport";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
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
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={student.name} subtitle={`${mn.common.class} ${student.class.name}`}>
        {children.length > 1 && <Link href="/parent" className={buttonClass("secondary", "sm")}>{mn.parent.backToChildren}</Link>}
      </PageHeader>
      <StudentBalancesView b={b} payments={payments} />
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>{mn.attendance.title}</h2>
          <MonthNav year={year} month={month} />
        </div>
        <AttendanceGrid key={`${year}-${month}`} students={[{ id, name: student.name }]} days={days} initial={initial} readOnly />
      </section>
      <FundReportView r={fund} classId={student.classId} />
    </div>
  );
}
