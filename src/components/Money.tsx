import { formatMNT } from "@/lib/money";
export function Money({ v }: { v: number }) {
  return <span className={v < 0 ? "text-red-700" : ""}>{formatMNT(v)}</span>;
}
