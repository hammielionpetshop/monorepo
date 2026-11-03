import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReopenSlipForm, reopenScreen, rupiah } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L31 Buka Kembali Slip (spec L4e §3.7): Pemilik/GM langsung, HR mengirim Minta buka kembali ke Persetujuan.
export default async function ReopenSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip.reopen', 'payslip.request_reopen']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await reopenScreen(actor, Number(id));
  if (!data) notFound();
  const { slip, effects } = data;
  const list = [
    `Slip ${slip.number} kembali menjadi Perkiraan; baris versi ${slip.version} disimpan sebagai riwayat. Nomor tetap; ditutup lagi menjadi versi ${slip.version + 1}.`,
    ...effects.funds.map((f) => `${f.fund}: mutasi slip ini dibalik (${f.amount < 0 ? '−' : '+'}${rupiah(Math.abs(f.amount))}).`),
    effects.bonuses ? `${effects.bonuses} baris bonus kembali Disahkan (bonus Dana Disiplin kembali Terpesan; Tersedia boleh minus).` : 'Tidak ada bonus yang dikembalikan.',
    'Sisa potongan yang diambil slip ini kembali Dibawa; sisa baru dari slip ini dibatalkan.',
    ...(effects.receivables ? [`Piutang Lain ${rupiah(effects.receivables)} dari slip ini dibalik.`] : []),
    `${slip.name} diberi tahu bahwa slipnya sedang dibetulkan beserta alasannya; pemilik lain juga diberi tahu.`,
  ];
  return (
    <>
      <PageHeader title={data.direct ? 'Buka kembali slip' : 'Minta buka kembali slip'} description={`${slip.name} · ${slip.number} · periode ${slip.period} · bersih ${rupiah(slip.net)}`} actions={<NewBadge feature="fitur/buka-kembali-slip" />} />
      {data.block ? <Alert tone="warn">{data.block}</Alert> : (
        <ReopenSlipForm mode={data.direct ? 'REOPEN' : 'REQUEST'} slipId={slip.id} title={`Slip ${slip.number}`} effects={list} back={`/gaji/slip/${slip.id}`} />
      )}
    </>
  );
}
