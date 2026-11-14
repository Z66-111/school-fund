"use client";
import { useActionState } from "react";
import { importAttendanceAction } from "@/actions/attendance";
import { buttonClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/client";

/** Upload an Excel workbook of monthly attendance sheets; shows what was taken from each sheet. */
export function AttendanceImport({ classId }: { classId: string }) {
  const mn = useT();
  const t = mn.attendanceImport;
  const [state, action, pending] = useActionState(importAttendanceAction, null);
  return (
    <details className="panel" open={state !== null || undefined}>
      <summary className="font-medium">{t.title}</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="classId" value={classId} />
        <p className="max-w-3xl text-sm text-ink-muted">{t.hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="input max-w-sm" aria-label={t.title} />
          <button disabled={pending} className={buttonClass("primary", "md")}>{t.submit}</button>
        </div>
      </form>
      {state && !state.ok && (
        <p className="mt-3 rounded-sm border-l-2 border-absent bg-absent-soft px-3 py-2 text-sm text-absent" role="alert">{state.error}</p>
      )}
      {state?.ok && (
        <section className="mt-4" role="status">
          <h3 className="mb-2 font-semibold">{t.result}</h3>
          <ul className="flex flex-col gap-3 text-sm">
            {state.report.map((r) => (
              <li key={r.sheet} className={`border-l-2 pl-3 ${r.status === "imported" && r.days > 0 ? "border-present" : "border-rule-strong"}`}>
                <div className="font-medium">
                  {t.sheet} «{r.sheet}»{r.year && r.month ? <span className="font-normal text-ink-muted">, {r.year} {mn.months[r.month - 1]}</span> : null}
                </div>
                {r.status !== "imported" ? (
                  <div className="text-ink-muted">{t[r.status]}</div>
                ) : (
                  <>
                    <div>
                      {t.imported}: <span className="num">{r.days}</span> {t.days}, {mn.attendance.present} <span className="num">{r.present}</span>, {mn.attendance.absent} <span className="num">{r.absent}</span>
                      {r.sick > 0 && <>, {mn.attendance.sick} <span className="num">{r.sick}</span></>}
                    </div>
                    {r.futureDays > 0 && <div className="text-ink-muted"><span className="num">{r.futureDays}</span> {t.futureDays}</div>}
                    {r.nonSchoolDays.length > 0 && <div className="text-ink-muted">{t.nonSchoolDays}: <span className="num">{r.nonSchoolDays.join(", ")}</span></div>}
                    {r.unknownMarks > 0 && <div className="text-ink-muted"><span className="num">{r.unknownMarks}</span> {t.unknownMarks}</div>}
                    {r.approximated.length > 0 && <div>{t.approximated}: {r.approximated.map((a) => `${a.from} → ${a.to}`).join("; ")}</div>}
                    {r.unmatched.length > 0 && <div className="text-absent">{t.unmatched}: {r.unmatched.join("; ")}</div>}
                    {r.missing.length > 0 && <div className="text-ink-muted">{t.missing}: {r.missing.join("; ")}</div>}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </details>
  );
}
