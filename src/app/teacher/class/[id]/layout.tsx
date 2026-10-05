import Link from "next/link";
import { requireClassPage } from "@/lib/page-auth";
import { getClass } from "@/services/classes";
import { mn } from "@/lib/i18n/mn";

export default async function ClassLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireClassPage(id, "TEACHER", "ADMIN");
  const c = await getClass(id);
  const base = `/teacher/class/${id}`;
  const tabs = [
    [`${base}/attendance`, mn.nav.attendance],
    [`${base}/students`, mn.nav.students],
    [`${base}/expenses`, mn.nav.expenses],
    [`${base}/report`, mn.nav.report],
  ];
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{c.name} — {c.schoolYear.name}</h1>
      <div className="mb-4 flex gap-4 border-b text-sm">
        {tabs.map(([href, label]) => <Link key={href} href={href} className="pb-1 hover:underline">{label}</Link>)}
      </div>
      {children}
    </div>
  );
}
