import { requireClassPage } from "@/lib/page-auth";
import { getClass } from "@/services/classes";
import { getT } from "@/lib/i18n/server";
import { ClassTabs } from "@/components/ClassTabs";

export default async function ClassLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const mn = await getT();
  const { id } = await params;
  await requireClassPage(id, "TEACHER", "ADMIN");
  const c = await getClass(id);
  const base = `/teacher/class/${id}`;
  const tabs = [
    { href: `${base}/attendance`, label: mn.nav.attendance },
    { href: `${base}/students`, label: mn.nav.students },
    { href: `${base}/report`, label: mn.nav.report },
    { href: `${base}/schedule`, label: mn.nav.schedule },
    { href: `${base}/announcement`, label: mn.nav.announcement },
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
