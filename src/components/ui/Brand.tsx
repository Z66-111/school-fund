import Image from "next/image";
import { mn } from "@/lib/i18n/mn";

/** The fundz.mn mark with the wordmark set in type, so it stays crisp at any size and in dark mode. */
export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  const px = size === "lg" ? 56 : 28;
  const text = size === "lg" ? "text-3xl" : "text-[17px]";
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/brand/mark.png" alt="" width={Math.round(px * 261 / 369)} height={px} priority className="shrink-0" />
      <span className={`${text} font-semibold leading-none tracking-tight`}>
        <span className="text-brand">fundz</span>
        <span className="text-ink-muted">.mn</span>
        <span className="sr-only"> {mn.app}</span>
      </span>
    </span>
  );
}
