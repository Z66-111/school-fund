import "server-only";
import { getActor } from "@/lib/session";
import { AppError, ValidationError } from "@/lib/errors";
import { formToObject } from "@/lib/validate";
import { mn } from "@/lib/i18n/mn";
import { localizeResult } from "@/lib/i18n/server";
import type { Actor } from "@/lib/roles";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Runs a form action; whatever text it returns is shown in the viewer's language. */
export async function runAction(
  fd: FormData,
  fn: (actor: Actor, data: Record<string, string>) => Promise<string | void>,
): Promise<ActionResult> {
  return localizeResult(await run(fd, fn));
}

async function run(
  fd: FormData,
  fn: (actor: Actor, data: Record<string, string>) => Promise<string | void>,
): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: mn.errors.loginRequired };
  try {
    const message = await fn(actor, formToObject(fd));
    return message ? { ok: true, message } : { ok: true };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof AppError) return { ok: false, error: e.message };
    throw e;
  }
}
