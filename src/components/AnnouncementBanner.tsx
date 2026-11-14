import { getT } from "@/lib/i18n/server";
import type { Announcement } from "@/services/announcements";

// Rough widths, only used to decide how many repeats fill the banner and how long one loop lasts.
const CHAR_PX = 9;
const GAP_PX = 56;
const FILL_PX = 1400; // wider than the widest banner (page max width), so no blank stretch ever shows
const SPEED_PX_PER_S = 55;

/**
 * An endless ticker of class announcements. The text repeats back to back and the loop point is
 * invisible, so it never appears to stop or start over. Pure CSS: pauses on hover or focus, and
 * sits still as wrapped text under reduced motion. `flush` drops the page gutter for use inside a box.
 */
export async function AnnouncementBanner({ items, flush = false }: { items: Announcement[]; flush?: boolean }) {
  const mn = await getT();
  if (items.length === 0) return null;
  const named = items.length > 1;
  const onePass = items.reduce((n, a) => n + (a.text.length + (named ? a.className.length + 2 : 0)) * CHAR_PX + GAP_PX, 0);
  const repeats = Math.min(20, Math.max(1, Math.ceil(FILL_PX / onePass)));
  const seconds = Math.round((onePass * repeats) / SPEED_PX_PER_S);
  // Only the very first pass is exposed to screen readers; every other copy is decoration.
  const line = (copy: number) => (
    <span className="marquee-line" aria-hidden={copy > 0 || undefined}>
      {Array.from({ length: repeats }, (_, r) =>
        items.map((a) => (
          <span key={`${r}-${a.classId}`} className="marquee-item" aria-hidden={(copy === 0 && r > 0) || undefined}>
            {named && <span className="font-semibold text-brand">{a.className}: </span>}
            {a.text}
          </span>
        )),
      )}
    </span>
  );
  return (
    <aside className="border-b border-rule bg-brand-soft" aria-label={mn.announcement.title}>
      <div className={`flex items-stretch ${flush ? "" : "mx-auto max-w-6xl px-5"}`}>
        <span className="z-10 flex shrink-0 items-center bg-brand px-3 text-sm font-semibold text-white">{mn.announcement.title}</span>
        <div className="marquee" tabIndex={0}>
          <div className="marquee-track" style={{ animationDuration: `${seconds}s` }}>
            {line(0)}
            {line(1)}
          </div>
        </div>
      </div>
    </aside>
  );
}
