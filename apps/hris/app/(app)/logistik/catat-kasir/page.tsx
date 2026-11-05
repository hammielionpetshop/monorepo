import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { ToRecordScreen, toRecordScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Perlu dicatat di kasir (spec LT1 §14.2 butir 3): keputusan potong nota / retur yang harus diketik Finance di kasir.
export default async function ToRecordPage() {
  const actor = await requirePageAction('logistics.note_cut.decide');
  if (!actor) return <NoAccess />;
  const data = await toRecordScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Perlu dicatat di kasir"
        description="Keputusan Potong nota dan Retur BO dari Laporan Toko yang belum dicatat di kasir."
        actions={<NewBadge feature="/logistik/catat-kasir" />}
      />
      <ToRecordScreen {...data} />
    </>
  );
}
