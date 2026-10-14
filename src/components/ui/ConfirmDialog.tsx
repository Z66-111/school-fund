"use client";
import { useEffect, useRef } from "react";
import { buttonClass, type ButtonVariant } from "@/components/ui/Button";
import { mn } from "@/lib/i18n/mn";

/** Modal confirmation on the native <dialog>, which gives focus trapping, Esc to cancel and a backdrop for free. */
export function ConfirmDialog({ open, message, confirmLabel, variant = "primary", onConfirm, onCancel }: {
  open: boolean;
  message: string;
  confirmLabel: string;
  variant?: ButtonVariant;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-md border border-rule bg-surface p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="flex flex-col gap-5 p-5">
        <p className="text-[15px] leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={buttonClass("secondary")}>{mn.common.cancel}</button>
          <button type="button" onClick={onConfirm} autoFocus className={buttonClass(variant === "secondary" || variant === "quiet" ? "primary" : variant)}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
