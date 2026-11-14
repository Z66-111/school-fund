import { requireClassPage } from "@/lib/page-auth";
import { getAnnouncement, ANNOUNCEMENT_MAX } from "@/services/announcements";
import { saveAnnouncementAction } from "@/actions/announcements";
import { ActionForm } from "@/components/ActionForm";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { Field } from "@/components/ui/Field";
import { getT } from "@/lib/i18n/server";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const mn = await getT();
  const { id } = await params;
  const actor = await requireClassPage(id, "TEACHER", "ADMIN");
  const current = await getAnnouncement(actor, id);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <ActionForm action={saveAnnouncementAction} submitLabel={mn.announcement.save} labels={{ text: mn.announcement.title }} preserve>
        <input type="hidden" name="classId" value={id} />
        <Field label={mn.announcement.label} hint={mn.announcement.hint}>
          <textarea name="text" defaultValue={current?.text ?? ""} maxLength={ANNOUNCEMENT_MAX} rows={3} placeholder={mn.announcement.placeholder} className="input" />
        </Field>
      </ActionForm>
      <section>
        <h2 className="mb-2">{mn.announcement.preview}</h2>
        {current ? (
          <div className="overflow-hidden rounded-md border border-rule">
            <AnnouncementBanner items={[current]} flush />
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{mn.announcement.none}</p>
        )}
      </section>
    </div>
  );
}
