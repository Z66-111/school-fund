import { Money } from "@/components/Money";

type Tone = "teal" | "due" | "good" | "neutral";
const rule: Record<Tone, string> = { teal: "border-teal", due: "border-due", good: "border-present", neutral: "border-rule-strong" };

/** A figure with a teal left rule, the ledger's margin line in miniature. */
export function StatTile({ label, value, tone = "teal", money = true }: { label: string; value: number | string; tone?: Tone; money?: boolean }) {
  return (
    <div className={`border-l-2 pl-3 ${rule[tone]}`}>
      <div className="text-sm text-ink-muted">{label}</div>
      <div className="num text-2xl font-semibold leading-tight">{typeof value === "number" && money ? <Money v={value} /> : value}</div>
    </div>
  );
}
