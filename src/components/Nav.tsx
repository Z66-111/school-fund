import Link from "next/link";
import { mn } from "@/lib/i18n/mn";
import { logoutAction } from "@/actions/auth";
import type { Role } from "@/lib/roles";

const links: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/admin", label: mn.nav.admin },
    { href: "/admin/classes", label: mn.nav.classes },
    { href: "/admin/users", label: mn.nav.users },
    { href: "/admin/school-years", label: mn.nav.schoolYears },
    { href: "/admin/holidays", label: mn.nav.holidays },
  ],
  TEACHER: [{ href: "/teacher", label: mn.nav.attendance }],
  ACCOUNTANT: [
    { href: "/accountant", label: mn.nav.outstanding },
    { href: "/accountant/payments", label: mn.nav.payments },
    { href: "/accountant/report", label: mn.nav.foodReport },
  ],
  PARENT: [{ href: "/parent", label: mn.nav.myChildren }],
};

export function Nav({ role }: { role: Role }) {
  return (
    <nav className="flex items-center gap-4 border-b bg-white px-4 py-2 text-sm">
      <span className="font-semibold">{mn.app}</span>
      {links[role].map((l) => (
        <Link key={l.href} href={l.href} className="hover:underline">
          {l.label}
        </Link>
      ))}
      <span className="ml-auto text-gray-500">{mn.roles[role]}</span>
      <form action={logoutAction}>
        <button className="underline">{mn.nav.logout}</button>
      </form>
    </nav>
  );
}
