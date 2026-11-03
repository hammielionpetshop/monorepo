import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReceivablesScreen, receivablesScreen, RECEIVABLE_STATUS_LABELS, type ReceivableStatus } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Piutang Lain (spec L4e §4): sisa kehilangan, minus kas, dan Potongan Lain yang tidak tertampung slip terakhir.
export default async function ReceivablesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePageAnyAction(['receivable.view', 'receivable.manage']);
  if (!actor) return <NoAccess />;
  const { status } = await searchParams;
  const filter = { status: status && status in RECEIVABLE_STATUS_LABELS ? (status as ReceivableStatus) : null };
  const data = await receivablesScreen(actor, filter);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Piutang Lain" description="Sisa potongan slip terakhir yang belum tertagih. Hapuskan oleh Pemilik atau GM." actions={<NewBadge feature="/gaji/piutang" />} />
      <ReceivablesScreen {...data} />
    </>
  );
}
