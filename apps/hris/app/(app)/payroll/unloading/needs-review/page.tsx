import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { UnloadingLookScreen, unloadingLookScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Peserta bongkaran yang hari itu izin, sakit, cuti, atau alpha (DRV-107): HR, tanpa nominal.
export default async function UnloadingLookPage() {
  const actor = await requirePageAnyAction(['unloading.review_day', 'unloading.view']);
  if (!actor) return <NoAccess />;
  const data = await unloadingLookScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Bongkaran Perlu Dilihat" description="Ikut bongkaran di hari yang tercatat izin, sakit, cuti, atau alpha. Upahnya tetap dibayar." />
      <UnloadingLookScreen {...data} />
    </>
  );
}
