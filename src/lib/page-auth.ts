import "server-only";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { assertClassAccess } from "@/lib/authz";
import type { Actor, Role } from "@/lib/roles";

export function homeFor(role: Role): string {
  return { ADMIN: "/admin", TEACHER: "/teacher", ACCOUNTANT: "/accountant", PARENT: "/parent" }[role];
}

export async function requirePage(...roles: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (roles.length && !roles.includes(actor.role)) redirect("/forbidden");
  return actor;
}

export async function requireClassPage(classId: string, ...roles: Role[]): Promise<Actor> {
  const actor = await requirePage(...roles);
  let allowed = false;
  try {
    await assertClassAccess(actor, classId);
    allowed = true;
  } catch {
    allowed = false;
  }
  if (!allowed) redirect("/forbidden");
  return actor;
}
