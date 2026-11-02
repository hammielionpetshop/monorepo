import { notFound, redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { getRequestActor } from '@/lib/authz';
import { EmployeeAccountCard, getEmployeeAccountPanel } from '@/modules/accounts';
import { NoAccess } from '@/modules/access';
import { LeaveScreen, leaveScreen } from '@/modules/attendance';
import { EmployeeDetailScreen, getEmployeeDetail } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KAR-L21 Halaman orang. Hak diperiksa per orang di layanan (lingkup diri/cabang/semua).
// L3f: kartu Sisa cuti + Sesuaikan sisa untuk HR, Pemilik, GM (spec L3f §9 butir 4).
export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const detail = await getEmployeeDetail(actor, Number(id));
  if (!detail) notFound();
  if (!detail.allowed) return <NoAccess />;
  const panel = detail.person ? await getEmployeeAccountPanel(actor, Number(id)) : null;
  const leave = detail.person && actor && actor.personId !== Number(id) ? await leaveScreen(actor, Number(id)) : null;
  const slot = (
    <>
      {panel && <EmployeeAccountCard panel={panel} />}
      {leave?.tracked && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">Sisa cuti <NewBadge feature="fitur/sisa-cuti-orang" /></h2>
          <LeaveScreen employeeId={Number(id)} self={false} {...leave} />
        </section>
      )}
    </>
  );
  return <EmployeeDetailScreen detail={detail} accountSlot={panel || leave?.tracked ? slot : null} />;
}
