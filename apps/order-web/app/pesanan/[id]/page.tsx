import { getShopName } from '@/lib/shop-name';
import { PortalShell } from '../../_components/portal-shell';
import { OrderDetailClient } from '../../_components/order-detail-client';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shopName = await getShopName();

  return (
    <PortalShell shopName={shopName}>
      <OrderDetailClient orderId={Number(id)} />
    </PortalShell>
  );
}
