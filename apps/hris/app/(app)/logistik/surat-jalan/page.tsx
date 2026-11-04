import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DeliveryNotesScreen, QUEUE_STATUSES, deliveryNotesScreen, type QueueStatus } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const idOf = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : null);

// Surat Jalan (spec LT1 §12): antrean nota dan PO Internal bertanda truk Gudang, dibaca langsung dari kasir.
export default async function DeliveryNotesPage({ searchParams }: {
  searchParams: Promise<{ tab?: string; asal?: string; rute?: string; cari?: string }>;
}) {
  const actor = await requirePageAction('logistics.delivery_note.view');
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const tab = QUEUE_STATUSES.includes(q.tab as QueueStatus) ? (q.tab as QueueStatus) : 'WAITING';
  const data = await deliveryNotesScreen(actor, { tab, originId: idOf(q.asal), routeId: idOf(q.rute), q: (q.cari ?? '').slice(0, 60) });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Surat Jalan"
        description="Kiriman truk Gudang dari semua cabang. Nominal, koreksi, dan batal mengikuti kasir."
        actions={<NewBadge feature="/logistik/surat-jalan" />}
      />
      <DeliveryNotesScreen {...data} />
    </>
  );
}
