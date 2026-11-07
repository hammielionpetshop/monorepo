import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DepositsScreen, depositsScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Titipan Toko (A1, spec docs/work/specs/2026-11-08-titipan-toko-design.md): Finance; pemegang Uang dari Toko melihat.
export default async function DepositsPage() {
  const { actor } = await getRequestActor();
  const data = await depositsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Titipan Toko"
        description="Uang lebih bayar / titip saja dari toko yang dipegang Gudang. Dipakai untuk melunasi nota lewat Pelunasan Piutang di kasir, atau dikembalikan tunai."
        actions={<NewBadge feature="/logistik/titipan" />}
      />
      <DepositsScreen {...data} />
    </>
  );
}
