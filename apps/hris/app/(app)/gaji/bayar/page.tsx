import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PaySlipFlow, payPreviewScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L34 Bayar Slip (spec L4f §3.1): dari Jadwal Bayar (banyak slip) atau layar Slip (satu slip).
export default async function PaySlipPage({ searchParams }: { searchParams: Promise<{ slip?: string; kembali?: string }> }) {
  const actor = await requirePageAnyAction(['payslip.pay']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const ids = [...new Set((q.slip ?? '').split(',').filter((x) => /^\d+$/.test(x)).map(Number))].slice(0, 300);
  const data = await payPreviewScreen(actor, ids);
  if (!data) return <NoAccess />;
  const back = q.kembali === 'slip' && ids.length === 1 ? `/gaji/slip/${ids[0]}` : '/gaji/jadwal-bayar';
  return (
    <>
      <PageHeader title="Bayar slip" description="Menandai slip Dibayar: sumber uang, tanggal uang, dan foto bukti disimpan bersama." />
      <PaySlipFlow {...data} back={back} />
    </>
  );
}
