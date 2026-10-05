import { z } from "zod";
import { mn } from "@/lib/i18n/mn";

export function formatMNT(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("en-US")} ₮`;
}

export const moneySchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.coerce.number({ invalid_type_error: mn.errors.positiveInt }).int(mn.errors.positiveInt).positive(mn.errors.positiveInt),
);
