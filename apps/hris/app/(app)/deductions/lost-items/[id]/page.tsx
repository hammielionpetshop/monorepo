import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LossDetailScreen, lossDetailScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Kartu pembagian satu kehilangan barang (GAJ-L12 klik baris).
export default async function LossDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['inventory_loss.view', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await lossDetailScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Kehilangan Barang ${data.loss.branchName}`} description="Pembagian ke orang yang ikut menanggung dan bagian kantor." />
      <LossDetailScreen {...data} />
    </>
  );
}
