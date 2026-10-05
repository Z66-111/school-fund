import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePage } from "@/lib/page-auth";
import { listChildren } from "@/services/students";
import { mn } from "@/lib/i18n/mn";

export default async function ParentHome() {
  const actor = await requirePage("PARENT");
  const children = await listChildren(actor.userId);
  if (children.length === 0) return <p>{mn.parent.noChildren}</p>;
  if (children.length === 1) redirect(`/parent/students/${children[0].id}`);
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">{mn.parent.selectChild}</h1>
      <ul className="list-disc pl-6">
        {children.map((s) => (
          <li key={s.id}><Link href={`/parent/students/${s.id}`} className="underline">{s.name} — {s.class.name}</Link></li>
        ))}
      </ul>
    </div>
  );
}
