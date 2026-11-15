import { redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { RuleBoardScreen, ruleBoard } from '@/modules/announcements';

export const dynamic = 'force-dynamic';

// Panduan › Papan Perubahan Aturan (spec F3-3 §3.7, BER-L08): hanya yang mengenai diri sendiri.
export default async function RuleBoardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const tab = (await searchParams).tab === 'history' ? 'history' : 'current';
  const result = await ruleBoard(actor, tab);
  if (!result.ok) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Papan Perubahan Aturan"
        description="Perubahan aturan perusahaan yang mengenai Anda, diumumkan sebelum berlaku. Perubahan sistem ada di Apa yang baru."
        actions={<NewBadge feature="/rule-board" />}
      />
      <RuleBoardScreen view={result.value} tab={tab} />
    </>
  );
}
