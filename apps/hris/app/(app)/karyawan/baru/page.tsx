import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess, getOrgLookup } from '@/modules/access';
import { NewEmployeeForm, todayWib } from '@/modules/employees';

export const dynamic = 'force-dynamic';

// Tambah Karyawan (KAR-60, pengganti pendaftaran): hanya Pemilik dan GM.
export default async function NewEmployeePage() {
  const actor = await requirePageAction('employee.create');
  if (!actor) return <NoAccess />;
  const org = await getOrgLookup();
  return (
    <>
      <PageHeader title="Tambah karyawan" description="Isian wajib: nama, cabang, jabatan, status kerja, dan tanggal bergabung." />
      <NewEmployeeForm
        today={todayWib()}
        branches={org.branches.filter((b) => b.active).map(({ id, name }) => ({ id, name }))}
        positions={org.positions.filter((p) => p.active && (!p.highRights || actor.fullAccess))
          .map(({ id, name, departmentName, highRights }) => ({ id, name, departmentName, highRights }))}
      />
    </>
  );
}
