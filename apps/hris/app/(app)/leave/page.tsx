import { EmptyState, PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LeaveScreen, leaveScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L31 Sisa Cuti Saya: hanya baca.
export default async function LeavePage() {
  const actor = await requirePageAnyAction(['attendance.self.check']);
  if (!actor) return <NoAccess />;
  const data = await leaveScreen(actor, null);
  return (
    <>
      <PageHeader title="Sisa Cuti Saya" description="Cuti tahunan dihitung dari tanggal bergabung. Sisa yang tidak dipakai hangus dan tidak diganti uang." />
      {!data ? <NoAccess /> : !data.tracked ? <EmptyState title={data.problem} /> : <LeaveScreen employeeId={null} self {...data} />}
    </>
  );
}
