import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess, can } from '@/modules/access';
import { WriteRuleScreen, canWriteRules, getDraft, ruleReaders } from '@/modules/announcements';
import { writeRuleOptions } from '../../form-data';

export const dynamic = 'force-dynamic';

// Lanjutkan konsep perubahan aturan (BER-L23). Yang sudah dikirim/terbit tidak bisa dibuka di sini.
export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['announcement.rule.draft', 'announcement.rule.publish']);
  if (!actor || !canWriteRules(actor)) return <NoAccess />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const draft = await getDraft(actor, id);
  if (!draft.ok || draft.value.status !== 'DRAFT') notFound();
  const corrects = draft.value.correctsAnnouncementId ? await ruleReaders(actor, draft.value.correctsAnnouncementId) : null;
  return (
    <>
      <PageHeader title={corrects ? 'Ralat perubahan aturan' : 'Tulis perubahan aturan'} />
      <WriteRuleScreen
        draft={draft.value}
        {...await writeRuleOptions(actor)}
        canPublish={can(actor, 'announcement.rule.publish')}
        fullAccess={actor.fullAccess}
        correctsTitle={corrects?.ok ? corrects.value.rule.title : null}
      />
    </>
  );
}
