"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/actions/locale";
import { useLocale } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n";

// Each language is named in itself, so it can be found by someone who cannot read the current one.
const NAMES: Record<Locale, { short: string; full: string }> = {
  mn: { short: "МН", full: "Монгол" },
  ru: { short: "РУ", full: "Русский" },
};

/** Language toggle. On phones each button is a full finger-sized target (44px high, 48px wide); it tightens up on wider screens. */
export function LanguageSwitch() {
  const current = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-rule-strong text-sm font-semibold sm:text-xs" role="group" aria-label="Хэл / Язык">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={NAMES[l].full}
          aria-label={NAMES[l].full}
          aria-pressed={l === current}
          disabled={pending}
          onClick={() => {
            if (l === current) return;
            start(async () => {
              await setLocaleAction(l);
              router.refresh();
            });
          }}
          className={`h-11 min-w-12 px-3 sm:h-8 sm:min-w-10 sm:px-2.5 ${l === current ? "bg-brand text-white" : "bg-surface text-ink-muted hover:text-ink"}`}
        >
          {NAMES[l].short}
        </button>
      ))}
    </div>
  );
}
