import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AdvanceForm, advanceFormScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// DRV-L25 Isikan Kasbon atas Nama (4 langkah): HR, Admin HR, Pemilik, GM; bukan untuk dirinya sendiri.
export default async function AdvanceFillForPage() {
  const actor = await requirePageAnyAction(['advance.fill_for']);
  if (!actor) return <NoAccess />;
  const data = await advanceFormScreen(actor, 'other');
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Isikan Kasbon atas Nama" description="Untuk siapa, berapa, alasan dari orangnya, lalu kirim." />
      <AdvanceForm {...data} />
    </>
  );
}
