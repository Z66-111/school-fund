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
  const [, start] = useTransition();

  const click = (studentId: string, iso: string) => {
    start(async () => {
      const r = await toggleAttendanceAction(studentId, iso);
      if (r.ok) {
        setError(null);
        setCells((c) => ({ ...c, [`${studentId}|${iso}`]: r.status }));
      } else setError(r.error);
    });
  };

  const label = (s: Status) => (s === "PRESENT" ? mn.attendance.presentShort : s === "ABSENT" ? mn.attendance.absentShort : "");
  const color = (s: Status) => (s === "PRESENT" ? "bg-green-200" : s === "ABSENT" ? "bg-red-200" : "bg-white");

  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
      <table className="border text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white p-1 text-left">{mn.common.student}</th>
            {days.map((d) => (
              <th key={d.iso} className={`w-7 p-0 text-center ${d.chargeable ? "" : "bg-gray-200 text-gray-400"}`}>
                {d.day}<br />{mn.weekdaysShort[d.weekday]}
              </th>
            ))}
            <th className="p-1">{mn.attendance.daysPresent}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const present = days.filter((d) => d.chargeable && cells[`${s.id}|${d.iso}`] === "PRESENT").length;
            return (
              <tr key={s.id} className="border-t">
                <td className="sticky left-0 bg-white p-1 whitespace-nowrap">{s.name}</td>
                {days.map((d) => {
                  const st = cells[`${s.id}|${d.iso}`] ?? null;
                  const disabled = readOnly || !d.chargeable || d.future;
                  return (
                    <td key={d.iso} className={`p-0 text-center ${d.chargeable ? color(st) : "bg-gray-200"}`}>
                      <button disabled={disabled} onClick={() => click(s.id, d.iso)} className="h-7 w-7 disabled:cursor-not-allowed">
                        {label(st)}
                      </button>
                    </td>
                  );
                })}
                <td className="p-1 text-center font-semibold">{present}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
