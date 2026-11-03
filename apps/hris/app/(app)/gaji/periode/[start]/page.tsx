import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PeriodScreen, periodScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const TABS = ['slip', 'tertahan', 'koreksi', 'riwayat'] as const;

// GAJ-L28 satu periode slip (spec L4e §4).
export default async function PeriodPage({ params, searchParams }: {
  params: Promise<{ start: string }>; searchParams: Promise<{ tab?: string; status?: string; cabang?: string }>;
}) {
  const actor = await requirePageAnyAction(['payslip.view']);
  if (!actor) return <NoAccess />;
  const { start } = await params;
  if (!/^\d{4}-\d{2}-26$/.test(start)) notFound();
  const q = await searchParams;
  const data = await periodScreen(actor, start);
  if (!data) notFound();
  const tab = TABS.find((t) => t === q.tab) ?? 'slip';
  const status = q.status === 'ESTIMATE' || q.status === 'CLOSED' ? q.status : null;
  return (
    <>
      <PageHeader title={`Periode Slip ${data.period.label}`} description="Satu baris per orang. Klik nama untuk membuka slipnya." />
      <PeriodScreen {...data} tab={tab} filter={{ status, branch: q.cabang || null }} />
    </>
  );
}
