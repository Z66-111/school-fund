import { formatMNT } from "@/lib/money";
export function Money({ v, className = "" }: { v: number; className?: string }) {
  return <span className={`num ${v < 0 ? "text-absent" : ""} ${className}`}>{formatMNT(v)}</span>;
}
