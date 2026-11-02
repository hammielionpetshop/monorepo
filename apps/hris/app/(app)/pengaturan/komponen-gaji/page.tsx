import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ComponentTypesScreen, componentTypesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L04 Jenis Komponen Gaji. Pemilik/GM mengubah; HR melihat.
export default async function ComponentTypesPage() {
  const actor = await requirePageAnyAction(['salary.view', 'salary_components.manage']);
  const data = actor ? await componentTypesScreen(actor) : null;
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Jenis Komponen Gaji" description="Daftar komponen yang bisa dipakai di gaji tiap orang." actions={<NewBadge feature="/pengaturan/komponen-gaji" />} />
      <ComponentTypesScreen {...data} />
    </>
  );
}
