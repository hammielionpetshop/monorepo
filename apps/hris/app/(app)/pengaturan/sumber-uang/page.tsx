import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PaymentSourcesScreen, paymentSourcesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Pengaturan › Sumber Uang (spec L4f §4; F2-1b): daftar baca Tempat Uang Back Office. Pemilik/GM.
export default async function PaymentSourcesPage() {
  const actor = await requirePageAnyAction(['payment_sources.manage']);
  if (!actor) return <NoAccess />;
  const data = await paymentSourcesScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Sumber Uang" description="Pilihan sumber uang saat membayar di HRIS, diambil dari Tempat Uang Back Office." actions={<NewBadge feature="/pengaturan/sumber-uang" />} />
      <PaymentSourcesScreen {...data} />
    </>
  );
}
