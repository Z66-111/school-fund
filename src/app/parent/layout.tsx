import { requirePage } from "@/lib/page-auth";
import { announcementsForParent } from "@/services/announcements";
import { Nav } from "@/components/Nav";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requirePage("PARENT");
  const announcements = await announcementsForParent(actor);
  return (
    <>
      <Nav role="PARENT" />
      <AnnouncementBanner items={announcements} />
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </>
  );
}
