import { notFound } from 'next/navigation';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SlipPrint, myPrintScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Unduh slip sendiri (GAJ-113): hanya slip Ditutup milik sendiri; Perkiraan ditolak. Tiap unduhan dicatat.
export default async function MySlipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await myPrintScreen(actor, { slipId: Number(id), periods: [] });
  if (!data) notFound();
  return <SlipPrint {...data} />;
}
