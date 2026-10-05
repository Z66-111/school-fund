"use client";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/action";

type Props = {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  labels?: Record<string, string>;
};

export function ActionForm({ action, submitLabel, children, className, confirm, labels }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const fieldMessages =
    state && !state.ok && state.fieldErrors
      ? [
          ...new Set(
            Object.entries(state.fieldErrors).flatMap(([k, msgs]) =>
              msgs.map((msg) => (labels?.[k] ? `${labels[k]}: ${msg}` : msg)),
            ),
          ),
        ]
      : [];
  return (
    <form
      action={formAction}
      className={className ?? "flex flex-col gap-2"}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && !state.ok && (
        <div className="text-sm text-red-700">
          <p>{state.error}</p>
          {fieldMessages.length > 0 && (
            <ul>
              {fieldMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state?.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
      <button disabled={pending} className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50">
        {submitLabel}
      </button>
    </form>
  );
}
