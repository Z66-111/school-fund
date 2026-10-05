import { requireClassPage } from "@/lib/page-auth";
import { getSchedule, slotKey, WEEKDAYS } from "@/services/schedule";
import { saveScheduleAction } from "@/actions/schedule";
import { ActionForm } from "@/components/ActionForm";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const s = await getSchedule(actor, id);
  const days = Array.from({ length: WEEKDAYS }, (_, i) => i + 1);
  return (
    <ActionForm action={saveScheduleAction} submitLabel={mn.schedule.save} className="flex flex-col gap-4">
      <input type="hidden" name="classId" value={id} />
      <div className="overflow-x-auto rounded-md border border-rule bg-surface">
        <table className="ledger">
          <thead>
            <tr>
              <th className="ctr">{mn.schedule.period}</th>
              <th>{mn.schedule.start}</th>
              <th>{mn.schedule.end}</th>
              {days.map((d) => <th key={d}>{mn.schedule.weekdays[d - 1]}</th>)}
            </tr>
          </thead>
          <tbody>
            {s.periods.map((p) => (
              <tr key={p.period}>
                <td className="ctr num w-px font-semibold">{p.period}</td>
                <td className="w-px"><input name={`start-${p.period}`} defaultValue={p.startTime ?? ""} placeholder="08:00" inputMode="numeric" size={5} className="input w-20" aria-label={`${mn.schedule.start} ${p.period}`} /></td>
                <td className="w-px"><input name={`end-${p.period}`} defaultValue={p.endTime ?? ""} placeholder="08:40" inputMode="numeric" size={5} className="input w-20" aria-label={`${mn.schedule.end} ${p.period}`} /></td>
                {days.map((d) => {
                  const k = slotKey(d, p.period);
                  const slot = s.slots[k];
                  return (
                    <td key={d} className="min-w-36">
                      <input name={`s-${k}`} defaultValue={slot?.subject ?? ""} maxLength={60} size={10} placeholder={mn.schedule.subject} className="input min-w-0" aria-label={`${mn.schedule.weekdays[d - 1]} ${p.period} ${mn.schedule.subject}`} />
                      <input name={`n-${k}`} defaultValue={slot?.note ?? ""} maxLength={60} size={10} placeholder={mn.schedule.note} className="input mt-1 min-w-0 text-xs" aria-label={`${mn.schedule.weekdays[d - 1]} ${p.period} ${mn.schedule.note}`} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ActionForm>
  );
}
