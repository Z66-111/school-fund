import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { assertStudentAccess } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { studentBalances } from "@/services/payments";
import { listChildren } from "@/services/students";
import { getSchedule } from "@/services/schedule";
import { ScheduleView } from "@/components/ScheduleView";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { buttonClass } from "@/components/ui/Button";
import { mn } from "@/lib/i18n/mn";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("PARENT");
  const { id } = await params;
  let allowed = true;
  try {
    await assertStudentAccess(actor, id);
  } catch {
    allowed = false;
  }
  if (!allowed) redirect("/forbidden");
  const student = await prisma.student.findUniqueOrThrow({ where: { id }, include: { class: true } });
  const [b, children] = await Promise.all([studentBalances(actor, id), listChildren(actor.userId)]);
  // A parent with one child is redirected here from /parent, so this page doubles as their home and carries the schedule.
  const schedule = children.length === 1 ? await getSchedule(actor, student.classId) : null;
  const total = b.foodOutstanding + b.fundDue;
  const items = [
    ...b.invoices
      .filter((i) => i.outstanding > 0)
      .map((i) => ({ key: i.id, label: `${mn.payment.FOOD}, ${i.year} ${mn.months[i.month - 1]}`, amount: i.outstanding })),
    ...(b.fundDue > 0 ? [{ key: "fund", label: mn.payment.ANNUAL_FUND, amount: b.fundDue }] : []),
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={student.name} subtitle={`${mn.common.class} ${student.class.name}`}>
        {children.length > 1 && <Link href="/parent" className={buttonClass("secondary", "sm")}>{mn.parent.backToChildren}</Link>}
      </PageHeader>
      <section className={`panel border-l-4 ${total > 0 ? "border-l-due" : "border-l-present"}`}>
        <div className="text-sm text-ink-muted">{mn.parent.dueNow}</div>
        <div className={`num text-4xl font-semibold leading-tight ${total > 0 ? "text-due" : "text-present"}`}><Money v={total} /></div>
        {total === 0 && <p className="mt-1 text-sm text-present">{mn.parent.nothingDue}</p>}
        {b.foodCredit > 0 && (
          <p className="mt-1 text-sm text-ink-muted">{mn.invoice.credit}: <Money v={b.foodCredit} /></p>
        )}
      </section>
      <div className="grid grid-cols-2 gap-6">
        <StatTile label={mn.payment.foodDue} value={b.foodOutstanding} tone={b.foodOutstanding > 0 ? "due" : "good"} />
        <StatTile label={mn.payment.fundDue} value={b.fundDue} tone={b.fundDue > 0 ? "due" : "good"} />
      </div>
      {items.length > 0 && (
        <section>
          <h2 className="mb-2">{mn.parent.toPay}</h2>
          <ul className="divide-y divide-rule rounded-md border border-rule bg-surface">
            {items.map((it) => (
              <li key={it.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>{it.label}</span>
                <Money v={it.amount} className="font-semibold" />
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link href={`/parent/students/${id}/detail`} className="panel flex items-center justify-between gap-3 hover:border-teal">
        <span>
          <span className="block font-semibold">{mn.parent.viewDetail}</span>
          <span className="block text-sm text-ink-muted">{mn.parent.detailHint}</span>
        </span>
        <span aria-hidden className="text-xl text-teal">›</span>
      </Link>
      {schedule && (
        <section className="flex flex-col gap-3">
          <h2>{mn.schedule.title}</h2>
          <ScheduleView s={schedule} />
        </section>
      )}
    </div>
  );
}
