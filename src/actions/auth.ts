"use server";
import { redirect } from "next/navigation";
import { authenticate } from "@/services/auth";
import { createSession, destroySession } from "@/lib/session";
import { homeFor } from "@/lib/page-auth";
import { AppError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { ActionResult } from "@/lib/action";
import type { Role } from "@/lib/roles";

export async function loginAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "");
  const password = String(fd.get("password") ?? "");
  let role: Role | null = null;
  try {
    const u = await authenticate(email, password);
    await createSession(u.id);
    role = u.role;
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
  if (!role) return { ok: false, error: mn.errors.invalidCredentials };
  redirect(homeFor(role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
