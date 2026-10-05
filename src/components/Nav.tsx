"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mn } from "@/lib/i18n/mn";
import { logoutAction } from "@/actions/auth";
import { buttonClass } from "@/components/ui/Button";
import type { Role } from "@/lib/roles";

const links: Record<Role, { href: string; label: string }[]> = {
  ADMIN: [
    { href: "/admin", label: mn.nav.admin },
    { href: "/admin/classes", label: mn.nav.classes },
    { href: "/admin/users", label: mn.nav.users },
    { href: "/admin/school-years", label: mn.nav.schoolYears },
    { href: "/admin/holidays", label: mn.nav.holidays },
    { href: "/accountant", label: mn.nav.outstanding },
    { href: "/accountant/payments", label: mn.nav.payments },
  ],
  TEACHER: [{ href: "/teacher", label: mn.nav.attendance }],
  ACCOUNTANT: [
    { href: "/accountant", label: mn.nav.outstanding },
    { href: "/accountant/payments", label: mn.nav.payments },
    { href: "/accountant/report", label: mn.nav.foodReport },
  ],
  PARENT: [{ href: "/parent", label: mn.nav.myChildren }],
};

function isActive(pathname: string, href: string, all: string[]) {
  if (pathname === href) return true;
  // Longest matching prefix wins, so /admin does not light up for /admin/users.
  const matches = all.filter((h) => pathname.startsWith(h + "/") || pathname === h);
  return matches.length > 0 && matches.sort((a, b) => b.length - a.length)[0] === href;
}

export function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = links[role];
  const hrefs = items.map((l) => l.href);
  return (
    <nav className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-5">
        <Link href="/" className="py-3 text-[15px] font-semibold tracking-tight text-teal">
          {mn.app}
        </Link>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm">
          {items.map((l) => {
            const active = isActive(pathname, l.href, hrefs);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 px-2 py-3 ${active ? "border-teal text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <span className="hidden text-xs text-ink-muted sm:inline">{mn.roles[role]}</span>
        <form action={logoutAction}>
          <button className={buttonClass("quiet", "sm")}>{mn.nav.logout}</button>
        </form>
      </div>
    </nav>
  );
}
