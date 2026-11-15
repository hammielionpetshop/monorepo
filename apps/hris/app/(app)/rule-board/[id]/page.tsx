import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { RuleDetailScreen, ruleDetail } from '@/modules/announcements';
import { shellSettingsToday } from '@/modules/settings';

export const dynamic = 'force-dynamic';

// Rincian perubahan aturan (spec F3-3 §3.7, BER-L09).
export default async function RuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const result = await ruleDetail(actor, id);
  if (!result.ok) return result.status === 404 ? notFound() : <NoAccess />;
  const settings = await shellSettingsToday();
  return (
    <>
      <PageHeader title="Perubahan aturan" />
      <RuleDetailScreen {...result.value} holdSeconds={settings.reminderHoldSeconds} />
    </>
  );
}
