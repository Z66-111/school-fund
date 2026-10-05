"use client";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/action";
import { buttonClass, type ButtonVariant, type ButtonSize } from "@/components/ui/Button";

type Props = {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  labels?: Record<string, string>;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function ActionForm({ action, submitLabel, children, className, confirm, labels, variant = "primary", size = "md" }: Props) {
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
      className={className ?? "flex flex-col gap-3"}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && !state.ok && (
        <div className="rounded-sm border-l-2 border-absent bg-absent-soft px-3 py-2 text-sm text-absent" role="alert">
          <p>{state.error}</p>
          {fieldMessages.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {fieldMessages.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state?.ok && state.message && (
        <p className="rounded-sm border-l-2 border-present bg-present-soft px-3 py-2 text-sm text-present" role="status">{state.message}</p>
      )}
      <button disabled={pending} className={`${buttonClass(variant, size)} self-start`}>
        {submitLabel}
      </button>
    </form>
  );
}
