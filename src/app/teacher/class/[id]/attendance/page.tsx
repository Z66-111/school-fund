import { requireClassPage } from "@/lib/page-auth";
import { getClass } from "@/services/classes";
import { listStudents } from "@/services/students";
import { getMonthAttendance, isMonthClosed } from "@/services/attendance";
import { holidayDates } from "@/services/holidays";
import { markAllPresentAction, clearDayAction } from "@/actions/attendance";
import { closeMonthAction } from "@/actions/month-close";
import { ActionForm } from "@/components/ActionForm";
import { AttendanceGrid, type GridDay } from "@/components/AttendanceGrid";
import { MonthNav } from "@/components/MonthNav";
import { Badge } from "@/components/ui/Badge";
import { monthDates, toISODate, todayDate, isFuture, isFutureMonth } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { mn } from "@/lib/i18n/mn";
import type { AttendanceStatus } from "@/lib/roles";

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
  const initial: Record<string, AttendanceStatus | null> = {};
  for (const r of rows) initial[`${r.studentId}|${toISODate(r.date)}`] = r.status as AttendanceStatus;
  const todayIso = toISODate(today);
  const todayInMonth = todayIso.startsWith(`${year}-${String(month).padStart(2, "0")}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav year={year} month={month}>
          {closed && <Badge tone="warn">{mn.attendance.closed}</Badge>}
        </MonthNav>
        {isTeacher && !closed && (
          <div className="flex flex-wrap items-center gap-2">
            {todayInMonth && (
              <ActionForm action={markAllPresentAction} submitLabel={mn.attendance.markAllPresentToday} className="inline-flex" variant="secondary" size="sm">
                <input type="hidden" name="classId" value={id} />
                <input type="hidden" name="date" value={todayIso} />
              </ActionForm>
            )}
            {todayInMonth && (
              <ActionForm action={clearDayAction} submitLabel={mn.attendance.clearToday} className="inline-flex" variant="secondary" size="sm">
                <input type="hidden" name="classId" value={id} />
                <input type="hidden" name="date" value={todayIso} />
              </ActionForm>
            )}
            {!isFutureMonth(year, month) && (
              <ActionForm action={closeMonthAction} submitLabel={mn.attendance.closeMonth} className="inline-flex" size="sm" confirm={mn.attendance.confirmClose}>
                <input type="hidden" name="classId" value={id} />
                <input type="hidden" name="year" value={year} />
                <input type="hidden" name="month" value={month} />
              </ActionForm>
            )}
          </div>
        )}
      </div>
      <AttendanceGrid key={`${year}-${month}`} students={students.map((s) => ({ id: s.id, name: s.name }))} days={days} initial={initial} readOnly={closed || actor.role !== "TEACHER"} classId={id} />
    </div>
  );
}
