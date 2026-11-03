import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { CloseSlipFlow, closePreviewScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L30 Tutup Slip, 3 langkah (spec L4e §3.5). `?slip=` untuk satu slip.
export default async function CloseSlipPage({ params, searchParams }: { params: Promise<{ start: string }>; searchParams: Promise<{ slip?: string }> }) {
  const actor = await requirePageAnyAction(['payslip.close']);
  if (!actor) return <NoAccess />;
  const { start } = await params;
  const { slip } = await searchParams;
  if (!/^\d{4}-\d{2}-26$/.test(start) || (slip && !/^\d+$/.test(slip))) notFound();
  const data = await closePreviewScreen(actor, start, slip ? Number(slip) : null);
  if (!data) notFound();
  if (!data.can.close) return <NoAccess />;
  return (
    <>
      <PageHeader title={data.single ? 'Tutup slip' : 'Tutup semua yang siap'} description={`Periode ${data.period.label}`} />
      <CloseSlipFlow period={data.period} ready={data.ready} held={data.held} totalNet={data.totalNet} zeroNet={data.zeroNet} withCarry={data.withCarry} single={data.single} objectionsWaiting={data.objectionsWaiting} />
    </>
  );
}
