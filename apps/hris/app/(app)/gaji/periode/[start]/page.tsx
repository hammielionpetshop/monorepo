import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PeriodScreen, SummaryScreen, payrollSummary, periodScreen, summaryViewOf } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const TABS = ['slip', 'tertahan', 'koreksi', 'riwayat', 'ringkasan'] as const;

// GAJ-L28 satu periode slip (spec L4e §4).
export default async function PeriodPage({ params, searchParams }: {
  params: Promise<{ start: string }>; searchParams: Promise<{ tab?: string; status?: string; cabang?: string }>;
}) {
  const actor = await requirePageAnyAction(['payslip.view']);
  if (!actor) return <NoAccess />;
  const { start } = await params;
  if (!/^W?\d{4}-\d{2}-\d{2}$/.test(start)) notFound();
  const q = await searchParams;
  const data = await periodScreen(actor, start);
  if (!data) notFound();
  const tab = TABS.find((t) => t === q.tab) ?? 'slip';
  // Ringkasan Gaji (L4f-2, GAJ-L38): Pemilik/GM semua; HR tanpa jabatan bertanda.
  const canSummary = !data.period.weekly && summaryViewOf(actor, false) != null;
  const summaryData = canSummary && tab === 'ringkasan'
    ? await payrollSummary(actor, start, { heldSlipIds: new Set(data.rows.filter((r) => r.holds.length).map((r) => r.slipId)) })
    : null;
  const summary = !canSummary ? null : summaryData ? <SummaryScreen {...summaryData} /> : <></>;
  const status = q.status && ['ESTIMATE', 'CLOSED', 'UNPAID', 'PAID'].includes(q.status) ? q.status : null;
  return (
    <>
      <PageHeader title={data.period.weekly ? `Slip Mingguan ${data.period.label.replace(/^minggu /, '')}` : `Periode Slip ${data.period.label}`} description="Satu baris per orang. Klik nama untuk membuka slipnya." />
      <PeriodScreen {...data} tab={tab} filter={{ status, branch: q.cabang || null }} summary={summary} />
    </>
  );
}
