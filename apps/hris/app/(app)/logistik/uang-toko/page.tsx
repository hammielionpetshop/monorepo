import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { StorePaymentsScreen, storePaymentsScreen, type PaymentSourceFilter } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const SOURCES: PaymentSourceFilter[] = ['ALL', 'TRUCK', 'SELF'];

// Uang dari Toko (spec LT1 §13.5 butir 6, §15.4 butir 1): cara bayar yang dicatat driver truk dan pengantar antar sendiri, untuk Finance.
export default async function StorePaymentsPage({ searchParams }: { searchParams: Promise<{ tanggal?: string; sumber?: string; cabang?: string }> }) {
  const actor = await requirePageAction('logistics.store_payment.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const date = q.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(q.tanggal) ? q.tanggal : today();
  const source = SOURCES.includes(q.sumber as PaymentSourceFilter) ? (q.sumber as PaymentSourceFilter) : 'ALL';
  const branch = Number(q.cabang);
  const data = await storePaymentsScreen(actor, date, { source, branchId: Number.isInteger(branch) && branch > 0 ? branch : null });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Uang dari Toko"
        description="Cara bayar toko yang dicatat driver truk dan pengantar antar sendiri saat Terkirim. Pencatatan ke kasir tetap diketik Finance."
        actions={<NewBadge feature="/logistik/uang-toko" />}
      />
      <StorePaymentsScreen {...data} />
    </>
  );
}
