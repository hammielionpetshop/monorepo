import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { StoreDetailScreen, StorePointCard, storeDetailScreen, storePointHistory } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Rincian toko (spec LT1 §12, titik toko §13.4).
export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const actor = await requirePageAction('logistics.store.view');
  if (!actor) return <NoAccess />;
  const data = await storeDetailScreen(actor, Number(id));
  if (!data) return <NoAccess />;
  if (data.notFound) notFound();
  const points = await storePointHistory(actor, data.store.customerId);
  return (
    <>
      <PageHeader title={data.store.name} description="Data pengiriman toko" />
      <div className="space-y-4">
        <StorePointCard customerId={data.store.customerId} name={data.store.name} {...points} />
        <StoreDetailScreen store={data.store} routes={data.routes} notes={data.notes} canManage={data.canManage} />
      </div>
    </>
  );
}
