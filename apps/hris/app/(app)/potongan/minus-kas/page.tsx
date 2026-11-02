import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { CashShortageScreen, cashShortageScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const TABS = ['pos', 'manual', 'check'] as const;

// GAJ-L15 Minus Kas (spec L4c §3.3, §3.4, §4): dari shift POS dan catat tangan.
export default async function CashShortagePage({ searchParams }: { searchParams: Promise<{ periode?: string; tab?: string }> }) {
  const actor = await requirePageAnyAction(['cash_shortage.view', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await cashShortageScreen(actor, { period: q.periode ?? null });
  if (!data) return <NoAccess />;
  const tab = TABS.find((t) => t === q.tab) ?? 'pos';
  return (
    <>
      <PageHeader title="Minus Kas" description="Minus kas per orang dari laporan POS Minus Kasir, dan minus di luar shift POS." actions={<NewBadge feature="/potongan/minus-kas" />} />
      <CashShortageScreen {...data} initialTab={tab} />
    </>
  );
}
