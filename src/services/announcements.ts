import { prisma } from "@/lib/db";
import { requireRole, assertClassAccess } from "@/lib/authz";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { mn } from "@/lib/i18n/mn";
import type { Actor } from "@/lib/roles";

export const ANNOUNCEMENT_MAX = 300;

export type Announcement = { classId: string; className: string; text: string; at: Date | null };

/** Line breaks and runs of spaces collapse to one space: the banner is a single moving line. */
const clean = (raw: string) => raw.replace(/\s+/g, " ").trim();

export async function getAnnouncement(actor: Actor, classId: string): Promise<Announcement | null> {
  await assertClassAccess(actor, classId);
  const c = await prisma.class.findUniqueOrThrow({ where: { id: classId }, select: { id: true, name: true, announcement: true, announcementAt: true } });
  return c.announcement ? { classId: c.id, className: c.name, text: c.announcement, at: c.announcementAt } : null;
}

/** Sets the class's one current announcement; empty text clears it. Returns whether an announcement is now showing. */
export async function saveAnnouncement(actor: Actor, classId: string, raw: string): Promise<boolean> {
  requireRole(actor, "TEACHER", "ADMIN");
  if (!classId) throw new NotFoundError();
  await assertClassAccess(actor, classId);
  const text = clean(raw ?? "");
  if (text.length > ANNOUNCEMENT_MAX) throw new ValidationError({ text: [mn.announcement.tooLong] });
  await prisma.class.update({ where: { id: classId }, data: { announcement: text, announcementAt: text ? new Date() : null } });
  return text !== "";
}

/** Current announcements from every class a parent has a linked child in, newest first. */
export async function announcementsForParent(actor: Actor): Promise<Announcement[]> {
  requireRole(actor, "PARENT");
  const classes = await prisma.class.findMany({
    where: { announcement: { not: "" }, students: { some: { parents: { some: { parentUserId: actor.userId } } } } },
    select: { id: true, name: true, announcement: true, announcementAt: true },
    orderBy: { announcementAt: "desc" },
  });
  return classes.map((c) => ({ classId: c.id, className: c.name, text: c.announcement, at: c.announcementAt }));
}
