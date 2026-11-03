import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SlipScreen, slipScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L29 Slip (spec L4e §4). Slip yang tidak boleh dilihat = tidak ditemukan.
export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip.view']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await slipScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Slip ${data.slip.name}`} description={`Periode ${data.slip.period.label} · ${data.slip.statusLabel}`} actions={<NewBadge feature="fitur/slip-gaji" />} />
      <SlipScreen {...data} />
    </>
  );
}
