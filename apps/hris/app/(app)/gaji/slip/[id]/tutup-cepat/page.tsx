import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ReopenSlipForm, slipExtras, slipScreen, rupiah } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Tutup lebih cepat slip terakhir (GAJ-96, spec L4e §3.7): Pemilik/GM, sesudah hari terakhir bekerja, tanpa penahan.
export default async function EarlyClosePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip.early_close']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [data, extras] = await Promise.all([slipScreen(actor, Number(id)), slipExtras(actor, Number(id))]);
  if (!data || !extras || data.slip.status !== 'ESTIMATE' || !extras.lastSlip) notFound();
  const blocked = extras.earlyBlock ?? (data.holds.length ? `Slip tertahan: ${data.holds.map((h) => h.text).join('; ')}.` : null);
  const effects = [
    `Slip terakhir ${data.slip.name} ditutup sekarang tanpa menunggu tanggal tutup; bersih saat ini ${rupiah(data.slip.totals.net)}.`,
    'Sisa telat, tidak hadir, dan denda yang tidak tertampung menjadi Tidak tertagih; sisa kehilangan, minus kas, dan Potongan Lain menjadi Piutang Lain.',
    ...(extras.withoutNotice ? ['Berhenti tanpa pemberitahuan: bonus yang belum masuk slip Hangus dan bersih yang tersisa menjadi denda.'] : []),
    'Masa keberatan 3 hari dihitung sejak ditutup. Orangnya diberi tahu.',
  ];
  return (
    <>
      <PageHeader title="Tutup lebih cepat" description={`${data.slip.name} · periode ${data.slip.period.label}`} actions={<NewBadge feature="fitur/tutup-lebih-cepat" />} />
      {blocked ? <Alert tone="warn">{blocked}</Alert> : (
        <ReopenSlipForm mode="EARLY" slipId={data.slip.slipId} title="Slip terakhir" effects={effects} back={`/gaji/slip/${data.slip.slipId}`} />
      )}
    </>
  );
}
