import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PendingPointsList, StoreTabs, StoresScreen, pendingPoints, storesScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Data Toko (spec LT1 §12): toko = pelanggan kasir; HRIS menambah rute bawaan, catatan pengiriman, dan titik (§13.4).
export default async function StoresPage({ searchParams }: { searchParams: Promise<{ cari?: string; tab?: string }> }) {
  const actor = await requirePageAction('logistics.store.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const header = <PageHeader title="Data Toko" description="Toko tujuan truk Gudang. Nama, HP, dan alamat diubah di kasir." actions={<NewBadge feature="/logistik/toko" />} />;
  if (q.tab === 'titik') {
    const points = await pendingPoints(actor);
    if (!points) return <NoAccess />;
    return (
      <>
        {header}
        <div className="space-y-4">
          <StoreTabs tab="points" pendingPoints={points.rows.length} />
          <p className="text-sm text-ink-muted">
            Titik yang dipasang driver/kenek dari kunjungan. Periksa foto depan toko dan petanya, lalu Setujui atau Tolak.
            {!points.canDecide && ' Hanya Kepala Gudang, Pemilik, dan GM yang bisa memutuskan.'}
          </p>
          <PendingPointsList rows={points.rows} canDecide={points.canDecide} />
        </div>
      </>
    );
  }
  const data = await storesScreen(actor, (q.cari ?? '').slice(0, 60));
  if (!data) return <NoAccess />;
  return (
    <>
      {header}
      <StoresScreen {...data} />
    </>
  );
}
