import { notFound } from 'next/navigation';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SlipPrint, printScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L32 cetak semua slip yang ditutup di satu periode (satu slip per lembar). Tiap cetak dicatat.
export default async function PrintPeriodPage({ params }: { params: Promise<{ start: string }> }) {
  const actor = await requirePageAnyAction(['payslip.view']);
  if (!actor) return <NoAccess />;
  const { start } = await params;
  if (!/^\d{4}-\d{2}-26$/.test(start)) notFound();
  const data = await printScreen(actor, { slipId: null, periodStart: start });
  if (!data) return <p className="text-sm text-ink-muted">Belum ada slip yang ditutup di periode ini.</p>;
  return <SlipPrint {...data} />;
}
