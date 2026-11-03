import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { UnloadingWeightsScreen, weightsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// DRV-L14 Berat per Satuan (spec L8 §4).
export default async function UnloadingWeightsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePageAnyAction(['unloading.view', 'unloading.create', 'unloading.decide']);
  if (!actor) return <NoAccess />;
  const data = await weightsScreen(actor, (await searchParams).tab ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Berat per Satuan" description="Berat per produk per satuan untuk Laporan Bongkaran, beserta riwayat perubahannya." actions={<NewBadge feature="fitur/bongkaran-berat" />} />
      <UnloadingWeightsScreen {...data} />
    </>
  );
}
