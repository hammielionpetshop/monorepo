import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { VisitReportsScreen, visitReportsScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Laporan Toko (spec LT1 §13.5 butir 4, 5): laporan driver sesudah Terkirim, ditutup kantor dengan catatan.
export default async function VisitReportsPage() {
  const actor = await requirePageAction('logistics.delivery_note.view');
  if (!actor) return <NoAccess />;
  const data = await visitReportsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Laporan Toko" description="Barang salah, kurang, rusak, retur, dan kendala lain dari kunjungan driver." actions={<NewBadge feature="/logistik/laporan-toko" />} />
      <VisitReportsScreen {...data} />
    </>
  );
}
