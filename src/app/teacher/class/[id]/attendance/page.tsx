import Link from "next/link";
import { requireClassPage } from "@/lib/page-auth";
import { getClass } from "@/services/classes";
import { listStudents } from "@/services/students";
import { getMonthAttendance, getMonthDaycare, isMonthClosed } from "@/services/attendance";
import { holidayDates } from "@/services/holidays";
import { closeMonthAction } from "@/actions/month-close";
import { ActionForm } from "@/components/ActionForm";
import { AttendanceGrid, type GridDay } from "@/components/AttendanceGrid";
import { MonthNav } from "@/components/MonthNav";
import { Badge } from "@/components/ui/Badge";
import { monthDates, toISODate, todayDate, isFuture, isFutureMonth } from "@/lib/dates";
import { isChargeable } from "@/lib/billing";
import { mn } from "@/lib/i18n/mn";
import type { AttendanceStatus } from "@/lib/roles";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ year?: string; month?: string; mode?: string }> }) {
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const isTeacher = actor.role === "TEACHER";
  const sp = await searchParams;
  const today = todayDate();
  const year = Number(sp.year ?? today.getUTCFullYear());
  const month = Number(sp.month ?? today.getUTCMonth() + 1);
  const mode = sp.mode === "daycare" ? "daycare" : "attendance";
  const c = await getClass(id);
  const [students, rows, holidays, closed] = await Promise.all([
    listStudents(id),
    mode === "daycare"
      ? getMonthDaycare(id, year, month).then((r) => r.map((x) => ({ ...x, status: "STAYED" })))
      : getMonthAttendance(id, year, month),
    holidayDates(c.schoolYearId),
    isMonthClosed(id, year, month),
  ]);
  const days: GridDay[] = monthDates(year, month).map((d) => ({
    iso: toISODate(d), day: d.getUTCDate(), weekday: d.getUTCDay(), chargeable: isChargeable(d, holidays), future: isFuture(d),
  }));
  const initial: Record<string, AttendanceStatus | "STAYED" | null> = {};
  for (const r of rows) initial[`${r.studentId}|${toISODate(r.date)}`] = r.status as AttendanceStatus | "STAYED";
  const todayIso = toISODate(today);
  const todayInMonth = todayIso.startsWith(`${year}-${String(month).padStart(2, "0")}`);

  const editable = isTeacher && !closed;
  const ym = `year=${year}&month=${month}`;
  const tab = (m: string, label: string, href: string) => (
    <Link href={href} className={`rounded-sm px-3 py-1 text-sm font-medium ${mode === m ? "bg-brand text-white" : "text-ink-muted hover:text-ink"}`}>{label}</Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav year={year} month={month} keep={mode === "daycare" ? "&mode=daycare" : ""}>
          {closed && <Badge tone="warn">{mn.attendance.closed}</Badge>}
        </MonthNav>
        <nav className="inline-flex gap-1 rounded-md border border-rule bg-surface p-1">
          {tab("attendance", mn.attendance.tabAttendance, `?${ym}`)}
          {tab("daycare", mn.attendance.tabDaycare, `?${ym}&mode=daycare`)}
        </nav>
      </div>
      {mode === "daycare" && <p className="text-sm text-ink-muted">{mn.attendance.daycareHint}</p>}
      <AttendanceGrid
        key={`${mode}-${year}-${month}`}
        mode={mode}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
        days={days}
        initial={initial}
        readOnly={!editable}
        classId={id}
        todayIso={todayInMonth ? todayIso : undefined}
        monthActions={editable && !isFutureMonth(year, month) && (
          <ActionForm action={closeMonthAction} submitLabel={mn.attendance.closeMonth} className="inline-flex" size="sm" confirm={mn.attendance.confirmClose}>
            <input type="hidden" name="classId" value={id} />
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
          </ActionForm>
        )}
      />
    </div>
  );
}
