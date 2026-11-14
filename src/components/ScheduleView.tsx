import { Table } from "@/components/ui/Table";
import { slotKey, WEEKDAYS, type Schedule } from "@/services/schedule";
import { getT } from "@/lib/i18n/server";

/** Read-only timetable; hides periods that have neither a subject nor a time. */
export async function ScheduleView({ s }: { s: Schedule }) {
  const mn = await getT();
  const days = Array.from({ length: WEEKDAYS }, (_, i) => i + 1);
  const rows = s.periods.filter((p) => p.startTime || p.endTime || days.some((d) => s.slots[slotKey(d, p.period)]));
  if (rows.length === 0) return <p className="text-sm text-ink-muted">{mn.common.empty}</p>;
  return (
    <Table>
      <thead>
        <tr>
          <th className="ctr">{mn.schedule.period}</th>
          {days.map((d) => <th key={d}>{mn.schedule.weekdays[d - 1]}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.period}>
            <td className="ctr whitespace-nowrap">
              <span className="num font-semibold">{p.period}</span>
              {(p.startTime || p.endTime) && (
                <span className="num block text-xs text-ink-muted">{p.startTime ?? ""}–{p.endTime ?? ""}</span>
              )}
            </td>
            {days.map((d) => {
              const slot = s.slots[slotKey(d, p.period)];
              return (
                <td key={d}>
                  {slot ? (
                    <>
                      <span className="font-medium">{slot.subject}</span>
                      {slot.note && <span className="block text-xs text-ink-muted">{slot.note}</span>}
                    </>
                  ) : (
                    <span className="text-ink-muted">{mn.common.none}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
