import { requireClassPage } from "@/lib/page-auth";
import { getClass } from "@/services/classes";
import { mn } from "@/lib/i18n/mn";
import { ClassTabs } from "@/components/ClassTabs";

export default async function ClassLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireClassPage(id, "TEACHER", "ADMIN");
  const c = await getClass(id);
  const base = `/teacher/class/${id}`;
  const tabs = [
    { href: `${base}/attendance`, label: mn.nav.attendance },
    { href: `${base}/students`, label: mn.nav.students },
    { href: `${base}/expenses`, label: mn.nav.expenses },
    { href: `${base}/report`, label: mn.nav.report },
    { href: `${base}/schedule`, label: mn.nav.schedule },
  ];
  return (
    <div>
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h1>{mn.common.class} {c.name}</h1>
        <span className="text-sm text-ink-muted">{c.schoolYear.name}</span>
      </header>
      <ClassTabs tabs={tabs} />
      {children}
    </div>
  );
}
