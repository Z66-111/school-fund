import { requireClassPage } from "@/lib/page-auth";
import Link from "next/link";
import { getClass } from "@/services/classes";
import { listStudents } from "@/services/students";
import { getMonthAttendance, isMonthClosed } from "@/services/attendance";
import { holidayDates } from "@/services/holidays";
import { markAllPresentAction } from "@/actions/attendance";
import { closeMonthAction } from "@/actions/month-close";
import { ActionForm } from "@/components/ActionForm";
import { AttendanceGrid, type GridDay } from "@/components/AttendanceGrid";
import { monthDates, toISODate, todayDate, isFuture, isFutureMonth } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string }> }) {
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const isTeacher = actor.role === "TEACHER";
  const sp = await searchParams;
  const today = todayDate();
  const year = Number(sp.year ?? today.getUTCFullYear());
  const month = Number(sp.month ?? today.getUTCMonth() + 1);
  const c = await getClass(id);
  const [students, rows, holidays, closed] = await Promise.all([
    listStudents(id),
    getMonthAttendance(id, year, month),
    holidayDates(c.schoolYearId),
    isMonthClosed(id, year, month),
  ]);
  const days: GridDay[] = monthDates(year, month).map((d) => ({
    iso: toISODate(d), day: d.getUTCDate(), weekday: d.getUTCDay(), chargeable: isChargeable(d, holidays), future: isFuture(d),
  }));
  const initial: Record<string, "PRESENT" | "ABSENT" | null> = {};
  for (const r of rows) initial[`${r.studentId}|${toISODate(r.date)}`] = r.status as "PRESENT" | "ABSENT";
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const todayIso = toISODate(today);
  const todayInMonth = todayIso.startsWith(`${year}-${String(month).padStart(2, "0")}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <Link href={`?year=${prev.y}&month=${prev.m}`} className="underline">←</Link>
        <span className="font-semibold">{year} {mn.months[month - 1]}</span>
        <Link href={`?year=${next.y}&month=${next.m}`} className="underline">→</Link>
        {closed && <span className="rounded bg-yellow-100 px-2">{mn.attendance.closed}</span>}
        {isTeacher && !closed && todayInMonth && (
          <ActionForm action={markAllPresentAction} submitLabel={mn.attendance.markAllPresentToday} className="inline">
            <input type="hidden" name="classId" value={id} />
            <input type="hidden" name="date" value={todayIso} />
          </ActionForm>
        )}
        {isTeacher && !closed && !isFutureMonth(year, month) && (
          <ActionForm action={closeMonthAction} submitLabel={mn.attendance.closeMonth} className="inline" confirm={mn.attendance.confirmClose}>
            <input type="hidden" name="classId" value={id} />
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
          </ActionForm>
        )}
      </div>
      <AttendanceGrid key={`${year}-${month}`} students={students.map((s) => ({ id: s.id, name: s.name }))} days={days} initial={initial} readOnly={closed || actor.role !== "TEACHER"} />
    </div>
  );
}
