import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SalaryListScreen, salaryListScreen, type SalaryListFilter } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L01 Gaji Karyawan (spec L4a §4).
export default async function SalaryListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageAnyAction(['salary.view', 'salary.change']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const filter: SalaryListFilter = { branch: params.branch, position: params.position, status: params.status, flag: params.flag, q: params.q };
  const data = await salaryListScreen(actor, filter);
  return (
    <>
      <PageHeader title="Gaji Karyawan" description="Gaji tetap sebulan semua orang bergaji bulanan, yang belum ada gaji, dan perubahan terjadwal." actions={<NewBadge feature="/gaji" />} />
      <SalaryListScreen {...data} filter={filter} />
    </>
  );
}
