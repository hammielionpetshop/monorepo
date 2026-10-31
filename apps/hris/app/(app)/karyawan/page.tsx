import Link from 'next/link';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess, hasAction } from '@/modules/access';
import { EmployeeListScreen, WORK_STATUSES, listEmployees, type EmployeeFilter, type WorkStatus } from '@/modules/employees';

export const dynamic = 'force-dynamic';

type Search = { q?: string; branchId?: string; positionId?: string; workStatus?: string; activity?: string; page?: string };

const positiveInt = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : undefined);

// KAR-L20 Daftar Karyawan (lengkap untuk employee.list, terbatas untuk employee.directory).
export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requirePageAnyAction(['employee.list', 'employee.directory']);
  if (!actor) return <NoAccess />;
  const search = await searchParams;
  const filter: EmployeeFilter = {
    q: search.q?.slice(0, 100),
    branchId: positiveInt(search.branchId),
    positionId: positiveInt(search.positionId),
    workStatus: WORK_STATUSES.includes(search.workStatus as WorkStatus) ? (search.workStatus as WorkStatus) : undefined,
    activity: search.activity === 'inactive' || search.activity === 'all' ? search.activity : 'active',
    page: positiveInt(search.page),
  };
  const listing = await listEmployees(actor, filter);
  const canCreate = hasAction(actor, 'employee.create');
  const canPromote = hasAction(actor, 'training_promotion.decide');
  return (
    <>
      <PageHeader
        title="Karyawan"
        description={listing.mode === 'directory'
          ? 'Daftar orang aktif untuk memberi izin tugas lapangan.'
          : 'Data induk karyawan. Yang berhenti dinonaktifkan, tidak dihapus.'}
        actions={(
          <>
            {canPromote && <Link href="/karyawan/promosi" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium">Promosi Training</Link>}
            {canCreate && <Link href="/karyawan/baru" className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Tambah karyawan</Link>}
          </>
        )}
      />
      <EmployeeListScreen listing={listing} filter={filter} />
    </>
  );
}
