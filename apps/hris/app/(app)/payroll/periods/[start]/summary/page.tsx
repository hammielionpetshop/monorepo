import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SummaryScreen, payrollSummary } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L38 Ringkasan Gaji bentuk Finance (spec L4f §3.8): total perusahaan saja, tanpa per cabang, dana, dan gaji Pemilik/GM.
export default async function FinanceSummaryPage({ params }: { params: Promise<{ start: string }> }) {
  const actor = await requirePageAnyAction(['payroll_summary.view']);
  if (!actor) return <NoAccess />;
  const { start } = await params;
  const data = await payrollSummary(actor, start, { finance: true });
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Ringkasan Gaji ${data.period.label}`} description="Dibaca dari slip yang sudah ditutup dan pembayarannya." />
      <SummaryScreen {...data} />
    </>
  );
}
