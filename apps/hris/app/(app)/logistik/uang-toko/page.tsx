import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { StorePaymentsScreen, storePaymentsScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

// Uang dari Toko (spec LT1 §13.5 butir 6): cara bayar yang dicatat driver saat Terkirim, untuk Finance.
export default async function StorePaymentsPage({ searchParams }: { searchParams: Promise<{ tanggal?: string }> }) {
  const actor = await requirePageAction('logistics.store_payment.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const date = q.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(q.tanggal) ? q.tanggal : today();
  const data = await storePaymentsScreen(actor, date);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Uang dari Toko"
        description="Cara bayar toko yang dicatat driver saat Terkirim. Pencatatan ke kasir tetap diketik Finance."
        actions={<NewBadge feature="/logistik/uang-toko" />}
      />
      <StorePaymentsScreen {...data} />
    </>
  );
}
