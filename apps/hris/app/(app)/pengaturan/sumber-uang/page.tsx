import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PaymentSourcesScreen, paymentSourcesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Pengaturan › Sumber Uang (spec L4f §4): tempat uang gaji dibayar. Pemilik/GM.
export default async function PaymentSourcesPage() {
  const actor = await requirePageAnyAction(['payment_sources.manage']);
  if (!actor) return <NoAccess />;
  const data = await paymentSourcesScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Sumber Uang" description="Pilihan sumber uang saat menandai slip Dibayar. Tidak dihapus; nonaktifkan yang tidak dipakai." actions={<NewBadge feature="/pengaturan/sumber-uang" />} />
      <PaymentSourcesScreen {...data} />
    </>
  );
}
