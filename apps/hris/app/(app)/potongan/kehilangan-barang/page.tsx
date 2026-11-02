import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LOSS_STATUS_LABELS, LossesScreen, lossesScreen, type LossStatus } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const idOf = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : null);

// GAJ-L12 Kehilangan Barang (spec L4c §3.2, §4).
export default async function LossesPage({ searchParams }: { searchParams: Promise<{ periode?: string; cabang?: string; status?: string }> }) {
  const actor = await requirePageAnyAction(['inventory_loss.view', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const status = (Object.keys(LOSS_STATUS_LABELS) as LossStatus[]).find((s) => s === q.status) ?? null;
  const data = await lossesScreen(actor, { period: q.periode ?? null, branchId: idOf(q.cabang), status });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Kehilangan Barang" description="Kehilangan hasil opname per cabang dan pembagiannya ke orang yang ikut menanggung." actions={<NewBadge feature="/potongan/kehilangan-barang" />} />
      <LossesScreen {...data} />
    </>
  );
}
