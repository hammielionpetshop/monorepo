import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SalaryPersonScreen, salaryPersonScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L02 Gaji Seseorang. Orang yang tidak boleh dilihat = tidak ditemukan (KAR-83).
export default async function SalaryPersonPage({ params, searchParams }: {
  params: Promise<{ employeeId: string }>; searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await requirePageAnyAction(['salary.view', 'salary.change']);
  if (!actor) return <NoAccess />;
  const { employeeId } = await params;
  if (!/^\d+$/.test(employeeId)) notFound();
  const data = await salaryPersonScreen(actor, Number(employeeId));
  if (!data) notFound();
  const { tab } = await searchParams;
  return (
    <>
      <PageHeader title={`Gaji ${data.person.name}`} />
      <SalaryPersonScreen {...data} tab={tab === 'riwayat' ? 'history' : 'now'} />
    </>
  );
}
