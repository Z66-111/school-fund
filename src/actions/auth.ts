"use server";
import { redirect } from "next/navigation";
import { authenticate } from "@/services/auth";
import { createSession, destroySession } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import { localizeResult } from "@/lib/i18n/server";
import type { ActionResult } from "@/lib/action";
import type { Role } from "@/lib/roles";

/** A failure whose message is shown in the viewer's language. */
const fail = (error: string) => localizeResult({ ok: false as const, error });

export async function loginAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  let role: Role | null = null;
  try {
    const u = await authenticate(email, password);
    await createSession(u.id);
    role = u.role;
  } catch (e) {
    if (e instanceof AppError) return fail(e.message);
    throw e;
  }
  if (!role) return fail(mn.errors.invalidCredentials);
  redirect(homeFor(role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
