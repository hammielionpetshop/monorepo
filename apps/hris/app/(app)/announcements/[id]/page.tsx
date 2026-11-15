import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReadersScreen, RuleReadersScreen, announcementKindOf, canOpenOffice, emergencyReaders, ruleReaders } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Siapa sudah dan belum baca (BER-L25): darurat (spec F3-2 §3.5) atau perubahan aturan (spec F3-3 §3.7).
export default async function AnnouncementReadersPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['announcement.view', 'announcement.emergency.send', 'announcement.rule.draft', 'announcement.rule.publish']);
  if (!actor || !canOpenOffice(actor)) return <NoAccess />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const kind = await announcementKindOf(id);
  if (!kind) notFound();
  if (kind === 'RULE') {
    const result = await ruleReaders(actor, id);
    if (!result.ok) return result.status === 404 ? notFound() : <NoAccess />;
    return (
      <>
        <PageHeader title="Siapa sudah dan belum baca" />
        <RuleReadersScreen {...result.value} />
      </>
    );
  }
  const result = await emergencyReaders(actor, id);
  if (!result.ok) return result.status === 404 ? notFound() : <NoAccess />;
  return (
    <>
      <PageHeader title="Siapa sudah dan belum baca" />
      <ReadersScreen {...result.value} />
    </>
  );
}
