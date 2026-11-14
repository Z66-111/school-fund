"use client";
import Image from "next/image";
import { useT } from "@/lib/i18n/client";

/** The angisan.mn mark with the wordmark set in type, so it stays crisp at any size and in dark mode. */
export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  const mn = useT();
  const px = size === "lg" ? 96 : 30;
  const text = size === "lg" ? "text-3xl" : "sr-only text-[17px] sm:not-sr-only";
  return (
    <span className={`inline-flex items-center ${size === "lg" ? "flex-col gap-3" : "gap-2"}`}>
      <Image src="/brand/angisan-mark.png" alt="" width={px} height={px} priority className="shrink-0" />
      <span className={`${text} font-semibold leading-none tracking-tight`}>
        <span className="text-brand">angisan</span>
        <span className="text-ink-muted">.mn</span>
        <span className="sr-only"> {mn.app}</span>
      </span>
    </span>
  );
}
