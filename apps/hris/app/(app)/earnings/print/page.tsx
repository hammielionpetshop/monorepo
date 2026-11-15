import { Alert } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SlipPrint, myPrintScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Unduh beberapa slip sendiri sekaligus (GAJ-113): paling banyak 12 slip Ditutup, satu slip satu halaman.
export default async function MyManyPrintPage({ searchParams }: { searchParams: Promise<{ periode?: string | string[] }> }) {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const periods = Array.isArray(q.periode) ? q.periode : q.periode ? [q.periode] : [];
  const data = await myPrintScreen(actor, { slipId: null, periods });
  if (!data) return <Alert tone="warn">Pilih 1 sampai 12 slip yang sudah ditutup.</Alert>;
  return <SlipPrint {...data} />;
}
