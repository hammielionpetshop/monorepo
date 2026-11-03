import { notFound } from 'next/navigation';
import { Alert, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { CancelPaymentForm, offSlipCancelScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Batal bayar di luar slip (spec L4f §3.7): membalik cicilan piutang, mutasi dana, dan status bonus.
export default async function OffSlipCancelPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip.cancel_payment']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await offSlipCancelScreen(actor, Number(id));
  if (!data) notFound();
  return (
    <>
      <PageHeader title="Batal bayar di luar slip" description={`${data.name} · ${data.label}`} />
      {!data.can ? <Alert tone="warn">Tagihan ini tidak punya pembayaran yang bisa Anda batalkan.</Alert> : (
        <CancelPaymentForm claimId={Number(id)} back="/gaji/jadwal-bayar" payment={data.lines} effects={data.effects} />
      )}
    </>
  );
}
