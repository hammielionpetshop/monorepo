import { notFound } from 'next/navigation';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SlipPrint, printScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L32 Cetakan satu slip: hanya slip Ditutup; server menolak mencetak Perkiraan. Tiap cetak dicatat.
export default async function PrintSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAnyAction(['payslip.view']);
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await printScreen(actor, { slipId: Number(id), periodStart: null });
  if (!data) notFound();
  return <SlipPrint {...data} />;
}
