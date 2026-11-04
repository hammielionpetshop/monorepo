import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { StoresScreen, storesScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Data Toko (spec LT1 §12): toko = pelanggan kasir; HRIS menambah rute bawaan dan catatan pengiriman.
export default async function StoresPage({ searchParams }: { searchParams: Promise<{ cari?: string }> }) {
  const actor = await requirePageAction('logistics.store.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await storesScreen(actor, (q.cari ?? '').slice(0, 60));
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Data Toko" description="Toko tujuan truk Gudang. Nama, HP, dan alamat diubah di kasir." actions={<NewBadge feature="/logistik/toko" />} />
      <StoresScreen {...data} />
    </>
  );
}
