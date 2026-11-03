import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { UnloadingListScreen, unloadingListScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// DRV-L11 Laporan Bongkaran (spec L8 §4): Kepala Gudang (HP), Finance, Pemilik, GM.
export default async function UnloadingPage({ searchParams }: { searchParams: Promise<{ tab?: string; dari?: string; sampai?: string; cari?: string }> }) {
  const actor = await requirePageAnyAction(['unloading.view', 'unloading.create', 'unloading.decide']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await unloadingListScreen(actor, { tab: q.tab ?? null, from: q.dari ?? null, to: q.sampai ?? null, q: q.cari ?? null });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Laporan Bongkaran" description="Upah bongkaran = total kg × tarif per kg, dibagi rata ke peserta, dibayar tunai hari itu." actions={<NewBadge feature="/gaji/bongkaran" />} />
      <UnloadingListScreen {...data} />
    </>
  );
}
