import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { StandardsScreen, standardsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L05 Gaji Standar. Pemilik/GM mengubah; HR melihat.
export default async function StandardsPage() {
  const actor = await requirePageAnyAction(['salary.view', 'salary_standard.manage']);
  const data = actor ? await standardsScreen(actor) : null;
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Gaji Standar" description="Paket acuan Training dan Karyawan untuk isian awal gaji." actions={<NewBadge feature="/pengaturan/gaji-standar" />} />
      <StandardsScreen {...data} />
    </>
  );
}
