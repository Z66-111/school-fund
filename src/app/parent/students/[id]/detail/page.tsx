import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { assertStudentAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { studentBalances, listPayments } from "@/services/payments";
import { classFundReport } from "@/services/reports";
import { getMonthAttendance, getMonthDaycareSkips } from "@/services/attendance";
import { holidayDates } from "@/services/holidays";
import { AttendanceGrid, type GridDay } from "@/components/AttendanceGrid";
import { MonthNav } from "@/components/MonthNav";
import { StudentBalancesView } from "@/components/StudentBalances";
import { FundReportView } from "@/components/FundReport";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { monthDates, toISODate, todayDate, isFuture } from "@/lib/dates";
import { isChargeable, daycareCells } from "@/lib/billing";
import { getT } from "@/lib/i18n/server";
import type { AttendanceStatus } from "@/lib/roles";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const mn = await getT();
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
  const [b, payments, fund, rows, skips, holidays] = await Promise.all([
    studentBalances(actor, id),
    listPayments(actor, id),
    classFundReport(actor, student.classId),
    getMonthAttendance(student.classId, year, month),
    getMonthDaycareSkips(student.classId, year, month),
    holidayDates(student.class.schoolYearId),
  ]);
  const days: GridDay[] = monthDates(year, month).map((d) => ({ iso: toISODate(d), day: d.getUTCDate(), weekday: d.getUTCDay(), chargeable: isChargeable(d, holidays), future: isFuture(d) }));
  const initial: Record<string, AttendanceStatus | null> = {};
  for (const r of rows) if (r.studentId === id) initial[`${id}|${toISODate(r.date)}`] = r.status as AttendanceStatus;
  const daycareInitial = daycareCells(student, days, new Set(skips.map((r) => `${r.studentId}|${toISODate(r.date)}`)));
  const hasDaycare = Object.keys(daycareInitial).length > 0;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={student.name} subtitle={`${mn.parent.detailTitle} · ${mn.common.class} ${student.class.name}`}>
        <Link href={`/parent/students/${id}`} className={buttonClass("secondary", "sm")}>{mn.parent.backToSummary}</Link>
      </PageHeader>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>{mn.attendance.title}</h2>
          <MonthNav year={year} month={month} />
        </div>
        <AttendanceGrid key={`${year}-${month}`} students={[{ id, name: student.name }]} days={days} initial={initial} readOnly />
        {hasDaycare && (
          <>
            <h3 className="mt-2 font-semibold">{mn.attendance.tabDaycare}</h3>
            <AttendanceGrid key={`dc-${year}-${month}`} mode="daycare" students={[{ id, name: student.name }]} days={days} initial={daycareInitial} readOnly />
            <p className="max-w-3xl text-sm text-ink-muted">{mn.invoice.daycareNote}</p>
          </>
        )}
      </section>
      <StudentBalancesView b={b} payments={payments} tiles={false} />
      <FundReportView r={fund} classId={student.classId} />
    </div>
  );
}
