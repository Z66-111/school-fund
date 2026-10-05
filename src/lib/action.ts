import "server-only";
import { getActor } from "@/lib/session";
import { AppError, ValidationError } from "@/lib/errors";
import { formToObject } from "@/lib/validate";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runAction(
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
