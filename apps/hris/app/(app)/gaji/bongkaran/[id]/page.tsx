import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { UnloadingDetailScreen, unloadingDetailScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// DRV-L13 Rincian Laporan Bongkaran (spec L8 §4).
export default async function UnloadingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['unloading.view', 'unloading.create', 'unloading.decide']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await unloadingDetailScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Laporan Bongkaran ${data.number}`} />
      <UnloadingDetailScreen data={data} />
    </>
  );
}
