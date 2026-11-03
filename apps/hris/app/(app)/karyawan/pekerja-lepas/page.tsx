import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { CasualWorkersScreen, casualWorkersScreen } from '@/modules/employees';
import { casualLastJoined } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// KAR-L28 Pekerja Lepas (spec L8 §9 butir 2).
export default async function CasualWorkersPage() {
  const actor = await requirePageAnyAction(['freelancer.manage', 'unloading.create']);
  if (!actor) return <NoAccess />;
  const data = await casualWorkersScreen(actor, await casualLastJoined());
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Pekerja Lepas" description="Orang yang ikut bongkaran tanpa menjadi karyawan: nama dan nomor HP saja." actions={<NewBadge feature="/karyawan/pekerja-lepas" />} />
      <CasualWorkersScreen {...data} />
    </>
  );
}
