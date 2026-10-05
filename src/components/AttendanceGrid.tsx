"use client";
import { useState, useTransition } from "react";
import { toggleAttendanceAction } from "@/actions/attendance";
import { mn } from "@/lib/i18n/mn";

export type GridStudent = { id: string; name: string };
export type GridDay = { iso: string; day: number; weekday: number; chargeable: boolean; future: boolean };
type Status = "PRESENT" | "ABSENT" | null;

export function AttendanceGrid({ students, days, initial, readOnly }: {
  students: GridStudent[];
  days: GridDay[];
  initial: Record<string, Status>; // key `${studentId}|${iso}`
  readOnly: boolean;
}) {
  const [cells, setCells] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(initial);
  if (seeded !== initial) { // re-seed when a revalidated server render passes new data
    setSeeded(initial);
    setCells(initial);
  }
  const [, start] = useTransition();

  const click = (studentId: string, iso: string) => {
    const key = `${studentId}|${iso}`;
    setPending((p) => new Set(p).add(key));
    start(async () => {
      const r = await toggleAttendanceAction(studentId, iso);
      setPending((p) => { const n = new Set(p); n.delete(key); return n; });
      if (r.ok) {
        setError(null);
        setCells((c) => ({ ...c, [`${studentId}|${iso}`]: r.status }));
      } else setError(r.error);
    });
  };

  const label = (s: Status) => (s === "PRESENT" ? mn.attendance.presentShort : s === "ABSENT" ? mn.attendance.absentShort : "");
  const tone = (s: Status) =>
    s === "PRESENT" ? "bg-present-soft text-present" : s === "ABSENT" ? "bg-absent-soft text-absent" : "bg-surface text-transparent ring-1 ring-inset ring-rule";

  return (
    <div className="flex flex-col gap-3">
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
                  <span className="num block text-[13px] text-ink">{d.day}</span>
                  <span className="block text-[10px]">{mn.weekdaysShort[d.weekday]}</span>
                </th>
              ))}
              <th className="sticky right-0 z-10 whitespace-nowrap border-l border-rule bg-surface px-3 py-2 text-right font-medium text-ink-muted">{mn.attendance.daysPresent}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const present = days.filter((d) => d.chargeable && cells[`${s.id}|${d.iso}`] === "PRESENT").length;
              return (
                <tr key={s.id} className="border-t border-rule">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1 text-sm">{s.name}</td>
                  {days.map((d) => {
                    const st = cells[`${s.id}|${d.iso}`] ?? null;
                    const disabled = readOnly || !d.chargeable || d.future || pending.has(`${s.id}|${d.iso}`);
                    if (!d.chargeable) return <td key={d.iso} className="bg-surface-2 p-0" />;
                    return (
                      <td key={d.iso} className="p-0.5">
                        <button
                          disabled={disabled}
                          onClick={() => click(s.id, d.iso)}
                          aria-label={`${s.name} ${d.iso}`}
                          className={`h-7 w-7 rounded-sm text-[12px] font-semibold transition-colors ${tone(st)} ${
                            disabled ? "cursor-not-allowed" : "hover:ring-1 hover:ring-teal"
                          } ${d.future ? "opacity-40" : ""}`}
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
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-present-soft ring-1 ring-present/40" />{mn.attendance.present}</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-absent-soft ring-1 ring-absent/40" />{mn.attendance.absent}</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-surface ring-1 ring-rule-strong" />{mn.attendance.unmarked}</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3.5 w-3.5 rounded-sm bg-surface-2" />{mn.attendance.nonChargeable}</span>
        {!readOnly && <span>{mn.attendance.clickToMark}</span>}
      </div>
    </div>
  );
}
