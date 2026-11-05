import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReturnedGoodsScreen, returnedGoodsScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Barang Kembali (spec LT1 §14.1 butir 1): pemegang hak terima barang kembali atau lihat trip.
export default async function ReturnedGoodsPage() {
  const { actor } = await getRequestActor();
  const data = await returnedGoodsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Barang Kembali"
        description="Barang tidak terkirim dan retur yang ikut pulang di truk: diterima di Gudang, lalu di cabang pemiliknya."
        actions={<NewBadge feature="/logistik/barang-kembali" />}
      />
      <ReturnedGoodsScreen {...data} />
    </>
  );
}
