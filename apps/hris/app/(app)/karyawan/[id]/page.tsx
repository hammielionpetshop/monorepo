import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { getRequestActor } from '@/lib/authz';
import { EmployeeAccountCard, getEmployeeAccountPanel } from '@/modules/accounts';
import { NoAccess, hasAction } from '@/modules/access';
import { LeaveScreen, leaveScreen } from '@/modules/attendance';
import { EmployeeDetailScreen, getEmployeeDetail } from '@/modules/employees';
import { salaryPersonScreen } from '@/modules/payroll';

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
  // L4a: kartu Gaji untuk yang berhak melihat gaji orang ini (orang bertanda hanya untuk Pemilik/GM).
  const salary = detail.person && (hasAction(actor, 'salary.view') || hasAction(actor, 'salary.change'))
    ? await salaryPersonScreen(actor, Number(id)) : null;
  const slot = (
    <>
      {salary && (
        <section className="space-y-2 rounded-card border border-line bg-surface p-4">
          <h2 className="flex items-center gap-2 font-semibold">Gaji <NewBadge feature="fitur/gaji-di-halaman-orang" /></h2>
          <p className="text-sm">
            {salary.current ? `Gaji tetap sebulan Rp${new Intl.NumberFormat('id-ID').format(salary.current.total)}.` : 'Belum ada gaji.'}
            {salary.scheduled.length ? ' Ada perubahan terjadwal.' : ''}
          </p>
          <Link className="text-sm text-brand-700 underline" href={`/gaji/${id}`}>Buka halaman gaji</Link>
        </section>
      )}
      {panel && <EmployeeAccountCard panel={panel} />}
      {leave?.tracked && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">Sisa cuti <NewBadge feature="fitur/sisa-cuti-orang" /></h2>
          <LeaveScreen employeeId={Number(id)} self={false} {...leave} />
        </section>
      )}
    </>
  );
  return <EmployeeDetailScreen detail={detail} accountSlot={panel || leave?.tracked || salary ? slot : null} />;
}
