import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { BonusApprovalScreen, bonusApprovalScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const TABS = ['grooming', 'delivery', 'free', 'changes', 'held', 'unpaired'] as const;

// GAJ-L20 Persetujuan Bonus (spec L4d §3.3, §4).
export default async function BonusApprovalPage({ searchParams }: { searchParams: Promise<{ periode?: string; tab?: string }> }) {
  const actor = await requirePageAnyAction(['bonus.view']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await bonusApprovalScreen(actor, { period: q.periode ?? null });
  if (!data) return <NoAccess />;
  const tab = TABS.find((t) => t === q.tab) ?? (q.tab === 'perubahan' ? 'changes' : 'grooming');
  return (
    <>
      <PageHeader title="Persetujuan Bonus" description="Satu tempat memutuskan bonus grooming dan ongkir sebelum slip ditutup." actions={<NewBadge feature="/bonus/persetujuan" />} />
      <BonusApprovalScreen {...data} initialTab={tab} />
    </>
  );
}
