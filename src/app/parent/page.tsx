import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { listChildren } from "@/services/students";
import { PageHeader } from "@/components/ui/PageHeader";
import { mn } from "@/lib/i18n/mn";

export default async function ParentHome() {
  const actor = await requirePage("PARENT");
  const children = await listChildren(actor.userId);
  if (children.length === 0) return <p className="text-ink-muted">{mn.parent.noChildren}</p>;
  if (children.length === 1) redirect(`/parent/students/${children[0].id}`);
  return (
    <div>
      <PageHeader title={mn.parent.selectChild} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((s) => (
          <li key={s.id}>
            <Link href={`/parent/students/${s.id}`} className="panel block hover:border-teal">
              <div className="text-lg font-semibold">{s.name}</div>
              <div className="text-sm text-ink-muted">{mn.common.class} {s.class.name}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
