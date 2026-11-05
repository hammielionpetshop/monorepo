import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SelfDeliveryScreen, selfDeliveryScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Antar sendiri (spec LT1 §15.2): nota kasir "Diantar kurir cabang" diantar karyawan cabang dengan tiga foto.
export default async function SelfDeliveryPage() {
  const actor = await requirePageAnyAction(['logistics.self_delivery.run', 'logistics.self_delivery.cash_receive', 'logistics.self_delivery.view']);
  if (!actor) return <NoAccess />;
  const data = await selfDeliveryScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Antar Sendiri" description="Nota kurir cabang: Foto 1 ambil barang, Foto 2 di tujuan, Foto 3 kembali di cabang." actions={<NewBadge feature="/logistik/antar-sendiri" />} />
      <SelfDeliveryScreen data={data} />
    </>
  );
}
