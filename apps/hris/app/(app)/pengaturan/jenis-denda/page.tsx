import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { FineKindsScreen, fineKindsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Jenis Denda (spec L7 §3.6, §4): Pemilik/GM mengubah; HR dan Kepala Gudang melihat.
export default async function FineKindsPage() {
  const actor = await requirePageAnyAction(['fine.view', 'fine.propose', 'fine_kind.manage']);
  if (!actor) return <NoAccess />;
  const data = await fineKindsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Jenis Denda" description="Denda driver & kenek per kejadian. Nominal bertanggal; jenis tidak dihapus, hanya dinonaktifkan." actions={<NewBadge feature="/pengaturan/jenis-denda" />} />
      <FineKindsScreen {...data} />
    </>
  );
}
