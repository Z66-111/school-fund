import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { listChildren } from "@/services/students";
import { studentBalances } from "@/services/payments";
import { getSchedule } from "@/services/schedule";
import { ScheduleView } from "@/components/ScheduleView";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { mn } from "@/lib/i18n/mn";

export default async function ParentHome() {
  const actor = await requirePage("PARENT");
  const children = await listChildren(actor.userId);
  if (children.length === 0) return <p className="text-ink-muted">{mn.parent.noChildren}</p>;
  if (children.length === 1) redirect(`/parent/students/${children[0].id}`);
  const classes = [...new Map(children.map((s) => [s.class.id, s.class])).values()];
  const [dues, schedules] = await Promise.all([
    Promise.all(children.map(async (s) => {
      const b = await studentBalances(actor, s.id);
      return b.foodOutstanding + b.fundDue;
    })),
    Promise.all(classes.map((c) => getSchedule(actor, c.id))),
  ]);
  return (
    <div className="flex flex-col gap-8">
      {classes.map((c, i) => (
        <section key={c.id} className="flex flex-col gap-3">
          <h2>{mn.schedule.title} <span className="font-normal text-ink-muted">{c.name}</span></h2>
          <ScheduleView s={schedules[i]} />
        </section>
      ))}
      <section>
        <PageHeader title={mn.parent.selectChild} />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((s, i) => (
            <li key={s.id}>
              <Link href={`/parent/students/${s.id}`} className="panel flex items-end justify-between gap-3 hover:border-teal">
                <span>
                  <span className="block text-lg font-semibold">{s.name}</span>
                  <span className="block text-sm text-ink-muted">{mn.common.class} {s.class.name}</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs text-ink-muted">{mn.parent.dueNow}</span>
                  <Money v={dues[i]} className={`font-semibold ${dues[i] > 0 ? "text-due" : "text-present"}`} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
