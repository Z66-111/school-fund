"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAttendanceAction, saveDaycareAction } from "@/actions/attendance";
import { buttonClass } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/lib/i18n/client";
import type { AttendanceStatus } from "@/lib/roles";

export type GridStudent = { id: string; name: string };
export type GridDay = { iso: string; day: number; weekday: number; chargeable: boolean; future: boolean };
export type GridMode = "attendance" | "daycare";
type Status = AttendanceStatus | "STAYED" | "SKIPPED" | null;
type Cells = Record<string, Status>; // key `${studentId}|${iso}`

// Click cycles per mode; `all` is what a day-number click fills in, `off` what a second click sets, `count` what the right-hand column totals.
// Daycare is prepaid: an enrolled day starts as STAYED and the teacher only marks the exceptions; a day with no cell is outside the enrolment.
const MODES: Record<GridMode, { next: Record<string, Status>; all: Status; off: Status; count: Status }> = {
  attendance: { next: { none: "PRESENT", PRESENT: "ABSENT", ABSENT: "SICK", SICK: null }, all: "PRESENT", off: null, count: "PRESENT" },
  daycare: { next: { none: null, STAYED: "SKIPPED", SKIPPED: "STAYED" }, all: "STAYED", off: "SKIPPED", count: "SKIPPED" },
};

/**
 * Month attendance grid. With `classId` and not `readOnly`, clicks only edit a local draft;
 * nothing is stored (or billed) until the teacher presses Хадгалах.
 */
export function AttendanceGrid({ students, days, initial, readOnly, classId, todayIso, monthActions, mode = "attendance" }: {
  students: GridStudent[];
  days: GridDay[];
  initial: Cells;
  readOnly: boolean;
  classId?: string;
  todayIso?: string;
  monthActions?: React.ReactNode; // e.g. close month; disabled while there are unsaved edits
  mode?: GridMode; // "daycare" marks the days an enrolled child skipped Өдөр өнжүүлэх instead of class attendance
}) {
  const mn = useT();
  const { next, all, off, count } = MODES[mode];
  const editable = !readOnly && !!classId;
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [cells, setCells] = useState(initial);
  const [seeded, setSeeded] = useState(initial);
  if (seeded !== initial) { // a revalidated server render passes the stored marks
    setSeeded(initial);
    setSaved(initial);
    setCells(initial);
  }
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const changes: { studentId: string; date: string; status: Status }[] = [];
  for (const s of students) {
    for (const d of days) {
      const k = `${s.id}|${d.iso}`;
      if ((cells[k] ?? null) !== (saved[k] ?? null)) changes.push({ studentId: s.id, date: d.iso, status: cells[k] ?? null });
    }
  }
  const dirty = changes.length > 0;

  // Warn before losing a draft: tab close / reload, and in-app links (month arrows, tabs, nav).
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const edit = (fn: (c: Cells) => Cells) => {
    setNotice(null);
    setError(null);
    setCells(fn);
  };
  const click = (studentId: string, iso: string) =>
    edit((c) => ({ ...c, [`${studentId}|${iso}`]: next[c[`${studentId}|${iso}`] ?? "none"] ?? null }));
  // In daycare mode only enrolled days can be marked; they are the ones that arrive with a cell.
  const markable = (k: string) => mode !== "daycare" || (saved[k] ?? null) !== null;
  const dayStudents = (iso: string) => students.filter((s) => markable(`${s.id}|${iso}`));
  const setDay = (iso: string, status: Status) =>
    edit((c) => {
      const n = { ...c };
      for (const s of dayStudents(iso)) n[`${s.id}|${iso}`] = status;
      return n;
    });
  const dayAllPresent = (iso: string) => dayStudents(iso).length > 0 && dayStudents(iso).every((s) => cells[`${s.id}|${iso}`] === all);
  const canMarkDay = (d: GridDay) => editable && d.chargeable && !d.future && dayStudents(d.iso).length > 0;
  const today = days.find((d) => d.iso === todayIso && canMarkDay(d));

  const save = () =>
    start(async () => {
      const r = mode === "daycare"
        ? await saveDaycareAction(classId!, changes.map((c) => ({ studentId: c.studentId, date: c.date, present: c.status !== "SKIPPED" })))
        : await saveAttendanceAction(classId!, changes.map((c) => ({ ...c, status: c.status as AttendanceStatus | null })));
      if (r.ok) {
        setSaved(cells);
        setError(null);
        setNotice(mn.attendance.saved);
      } else setError(r.error);
    });

  const dayAllLabel = mode === "daycare" ? mn.attendance.allStayedToday : mn.attendance.dayAllPresent;
  const dayOffLabel = mode === "daycare" ? mn.attendance.dayAllSkipped : mn.attendance.dayClear;
  const label = (s: Status) =>
    s === "STAYED" ? mn.attendance.daycareMark : s === "SKIPPED" ? mn.attendance.daycareSkipMark : s === "PRESENT" ? mn.attendance.presentShort : s === "ABSENT" ? mn.attendance.absentShort : s === "SICK" ? mn.attendance.sickShort : "";
  const tone = (s: Status) =>
    s === "STAYED"
      ? "bg-brand-soft text-brand"
      : s === "PRESENT"
      ? "bg-present-soft text-present"
      : s === "ABSENT" || s === "SKIPPED"
        ? "bg-absent-soft text-absent"
        : s === "SICK"
          ? "bg-due-soft text-ink"
          : "bg-surface text-transparent ring-1 ring-inset ring-rule";

  return (
    <div className="flex flex-col gap-3">
      {editable && (
        <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 bg-paper px-1 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {today && (
              <>
                <button type="button" onClick={() => setDay(today.iso, all)} className={buttonClass("secondary", "sm")}>{mode === "daycare" ? mn.attendance.allStayedToday : mn.attendance.markAllPresentToday}</button>
                {mode !== "daycare" && <button type="button" onClick={() => setDay(today.iso, null)} className={buttonClass("secondary", "sm")}>{mn.attendance.clearToday}</button>}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && <span className="rounded-sm bg-due-soft px-2 py-0.5 text-sm text-ink">{changes.length} {mn.attendance.unsaved}</span>}
            {!dirty && notice && <span className="text-sm text-present" role="status">{notice}</span>}
            {dirty && <button type="button" disabled={saving} onClick={() => edit(() => saved)} className={buttonClass("secondary", "sm")}>{mn.common.cancel}</button>}
            <button type="button" disabled={!dirty || saving} onClick={save} className={buttonClass("primary", "sm")}>{mn.common.save}</button>
            {monthActions && (
              <fieldset disabled={dirty || saving} title={dirty ? mn.attendance.saveFirst : undefined} className="contents">{monthActions}</fieldset>
            )}
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-sm border-l-2 border-absent bg-absent-soft px-3 py-2 text-sm text-absent" role="alert">{error}</p>
      )}
      <div className="overflow-x-auto rounded-md border border-rule bg-surface">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium text-ink-muted">{mn.common.student}</th>
              {days.map((d) => (
                <th
                  key={d.iso}
                  className={`w-8 min-w-8 px-0 py-1 text-center font-medium leading-tight ${d.chargeable ? "text-ink-muted" : "bg-surface-2 text-ink-muted/60"}`}
                >
                  {canMarkDay(d) ? (
                    <button
                      type="button"
                      onClick={() => setDay(d.iso, dayAllPresent(d.iso) ? off : all)}
                      title={dayAllPresent(d.iso) ? dayOffLabel : dayAllLabel}
                      aria-label={`${d.iso}: ${dayAllPresent(d.iso) ? dayOffLabel : dayAllLabel}`}
                      className={`w-full rounded-sm py-0.5 hover:bg-brand-soft hover:text-brand ${dayAllPresent(d.iso) ? "bg-present-soft" : ""}`}
                    >
                      <span className="num block text-[13px] text-ink">{d.day}</span>
                      <span className="block text-[10px]">{mn.weekdaysShort[d.weekday]}</span>
                    </button>
                  ) : (
                    <>
                      <span className="num block text-[13px] text-ink">{d.day}</span>
                      <span className="block text-[10px]">{mn.weekdaysShort[d.weekday]}</span>
                    </>
                  )}
                </th>
              ))}
              <th className="sticky right-0 z-10 whitespace-nowrap border-l border-rule bg-surface px-3 py-2 text-right font-medium text-ink-muted">{mode === "daycare" ? mn.attendance.daycareSkippedDays : mn.attendance.daysPresent}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const present = days.filter((d) => d.chargeable && cells[`${s.id}|${d.iso}`] === count).length;
              return (
                <tr key={s.id} className="border-t border-rule">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1 text-sm">{s.name}</td>
                  {days.map((d) => {
                    const k = `${s.id}|${d.iso}`;
                    const st = cells[k] ?? null;
                    const changed = st !== (saved[k] ?? null);
                    const disabled = !editable || d.future || saving;
                    if (!d.chargeable) return <td key={d.iso} className="bg-surface-2 p-0" />;
                    if (mode === "daycare" && st === null) return <td key={d.iso} className="p-0.5"><span className="block h-7 w-7 rounded-sm bg-surface-2/70" /></td>;
                    return (
                      <td key={d.iso} className="p-0.5">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => click(s.id, d.iso)}
                          aria-label={`${s.name} ${d.iso}`}
                          className={`h-7 w-7 rounded-sm text-[12px] font-semibold transition-colors ${tone(st)} ${
                            disabled ? "cursor-not-allowed" : "hover:ring-1 hover:ring-brand"
                          } ${changed ? "outline-2 outline-offset-1 outline-dashed outline-brand" : ""} ${d.future ? "opacity-40" : ""}`}
                        >
                          {label(st)}
                        </button>
                      </td>
                    );
                  })}
                  <td className="num sticky right-0 z-10 border-l border-rule bg-surface px-3 py-1 text-right text-sm font-semibold">{present}</td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr className="border-t border-rule"><td colSpan={days.length + 2} className="px-3 py-3 text-sm text-ink-muted">{mn.common.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted">
        <span>{mn.attendance.legend}:</span>
        {mode === "daycare" ? (
          <>
            <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-brand-soft ring-1 ring-brand/40" />{mn.attendance.daycareStayed}</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-absent-soft ring-1 ring-absent/40" />{mn.attendance.daycareSkipped}</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-surface-2/70" />{mn.attendance.daycareNotEnrolled}</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-present-soft ring-1 ring-present/40" />{mn.attendance.present}</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-absent-soft ring-1 ring-absent/40" />{mn.attendance.absent}</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-due-soft ring-1 ring-due/40" />{mn.attendance.sick}</span>
          </>
        )}
        {mode !== "daycare" && <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-surface ring-1 ring-rule-strong" />{mn.attendance.unmarked}</span>}
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-surface-2" />{mn.attendance.nonChargeable}</span>
        {editable && <span>{mn.attendance.clickToMark}</span>}
        {editable && <span>{mn.attendance.clickDayHint}</span>}
      </div>
      {editable && (
        <ConfirmDialog
          open={leaveTo !== null}
          message={mn.attendance.unsavedLeave}
          confirmLabel={mn.attendance.leaveWithoutSaving}
          variant="danger"
          onCancel={() => setLeaveTo(null)}
          onConfirm={() => {
            const to = leaveTo!;
            setLeaveTo(null);
            setCells(saved); // drop the draft so the guard lets the navigation through
            router.push(to);
          }}
        />
      )}
    </div>
  );
}
