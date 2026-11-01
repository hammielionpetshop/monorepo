import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess, positionNamesByAction } from '@/modules/access';
import { RequestTypesScreen, requestTypeRows } from '@/modules/requests';

export const dynamic = 'force-dynamic';

// BER-L42 Jenis Pengajuan (hanya-lihat).
export default async function RequestTypesPage() {
  const actor = await requirePageAction('request_types.view');
  if (!actor) return <NoAccess />;
  const rows = requestTypeRows(await positionNamesByAction());
  return (
    <>
      <PageHeader title="Jenis Pengajuan" description="Jenis pengajuan yang terdaftar di Mesin Pengajuan beserta penyetuju dan aturannya." />
      <RequestTypesScreen rows={rows} />
    </>
  );
}
