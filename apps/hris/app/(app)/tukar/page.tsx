import { EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SwapScreen, swapScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L28 Tukar Libur dan Shift.
export default async function SwapPage() {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const data = await swapScreen(actor);
  return (
    <>
      <PageHeader title="Tukar Libur dan Shift" description="Tukar dengan teman satu cabang. Bila teman menerima, jadwal kalian langsung berubah." />
      {data.tracked ? <SwapScreen {...data} /> : <EmptyState title="Tukar libur tidak berlaku untuk jabatan Anda." />}
    </>
  );
}
