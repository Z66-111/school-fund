type Tone = "neutral" | "good" | "bad" | "warn" | "brand";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  good: "bg-present-soft text-present",
  bad: "bg-absent-soft text-absent",
  warn: "bg-due-soft text-due",
  brand: "bg-brand-soft text-brand",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
