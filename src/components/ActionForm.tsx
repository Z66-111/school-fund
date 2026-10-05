"use client";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/action";

type Props = {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
};

export function ActionForm({ action, submitLabel, children, className, confirm }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
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
          {state.fieldErrors &&
            Object.entries(state.fieldErrors).map(([k, msgs]) => (
              <p key={k}>
                {k}: {msgs.join(", ")}
              </p>
            ))}
        </div>
      )}
      {state?.ok && state.message && <p className="text-sm text-green-700">{state.message}</p>}
      <button disabled={pending} className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50">
        {submitLabel}
      </button>
    </form>
  );
}
