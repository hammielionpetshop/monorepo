import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess, OrganizationScreen, hasAction, listOrganization } from '@/modules/access';

export const dynamic = 'force-dynamic';

// KAR-L30 Cabang & Jabatan.
export default async function OrganizationPage() {
  const actor = await requirePageAction('org.manage');
  if (!actor) return <NoAccess />;
  const data = await listOrganization();
  return (
    <>
      <PageHeader
        title="Cabang & Jabatan"
        description="Daftar cabang, departemen, dan jabatan. Yang berhenti dipakai dinonaktifkan, tidak dihapus."
      />
      <OrganizationScreen data={data} canEditHighRights={hasAction(actor, 'position.high_rights.update')} />
    </>
  );
}
