import { notFound, redirect } from 'next/navigation';
import { getRequestActor } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { EmployeeDetailScreen, getEmployeeDetail } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// KAR-L21 Halaman orang. Hak diperiksa per orang di layanan (lingkup diri/cabang/semua).
export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { session, actor } = await getRequestActor();
  if (!session.ok) redirect('/login');
  const detail = await getEmployeeDetail(actor, Number(id));
  if (!detail) notFound();
  if (!detail.allowed) return <NoAccess />;
  return <EmployeeDetailScreen detail={detail} />;
}
