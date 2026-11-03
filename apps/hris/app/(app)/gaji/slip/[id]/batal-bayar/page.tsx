import { notFound } from 'next/navigation';
import { Alert, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { CancelPaymentForm, rupiah, slipPayment, slipScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L35 Batal Bayar (spec L4f §3.3): Pemilik/GM, alasan wajib, tahan 3 detik.
export default async function CancelPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip.cancel_payment']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [data, payment] = await Promise.all([slipScreen(actor, Number(id)), slipPayment(actor, Number(id))]);
  if (!data || !payment) notFound();
  const p = payment.paid;
  return (
    <>
      <PageHeader title="Batal bayar" description={`${data.slip.name} · ${data.slip.number ?? ''} · periode ${data.slip.period.label}`} />
      {!p || p.kind !== 'MONEY' || !payment.can.cancel ? <Alert tone="warn">Slip ini tidak punya pembayaran uang yang bisa Anda batalkan.</Alert> : (
        <CancelPaymentForm
          slipId={data.slip.slipId}
          back={`/gaji/slip/${data.slip.slipId}`}
          payment={[
            `${data.slip.name}, slip ${data.slip.number}: ${rupiah(p.amount)}`,
            `Tanggal uang ${p.moneyDate} dari ${p.source} (${p.method})`,
            `Ditandai Dibayar oleh ${p.by} · ${p.recordedAt}`,
          ]}
        />
      )}
    </>
  );
}
