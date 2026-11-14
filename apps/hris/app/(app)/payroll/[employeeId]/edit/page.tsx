import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SalaryEditScreen, salaryEditScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L03 Ubah Gaji (4 langkah). ?standar=1 = isian awal dari Gaji Standar sesuai status kerja.
export default async function SalaryEditPage({ params, searchParams }: {
  params: Promise<{ employeeId: string }>; searchParams: Promise<{ standar?: string }>;
}) {
  const actor = await requirePageAnyAction(['salary.propose', 'salary.change']);
  if (!actor) return <NoAccess />;
  const { employeeId } = await params;
  if (!/^\d+$/.test(employeeId)) notFound();
  const { standar } = await searchParams;
  const data = await salaryEditScreen(actor, Number(employeeId), standar === '1');
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`${data.canChange ? 'Ubah' : 'Usulkan ubah'} gaji ${data.person.name}`} />
      <SalaryEditScreen person={data.person} choices={data.choices} types={data.types} startLines={data.startLines}
        standard={data.standard} usedStandard={data.usedStandard} canChange={data.canChange} divisor={data.divisor} />
    </>
  );
}
