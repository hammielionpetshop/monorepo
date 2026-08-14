import { getShopName } from '@/lib/shop-name';
import { PortalShell } from '../_components/portal-shell';
import { OrdersClient } from '../_components/orders-client';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const shopName = await getShopName();

  return (
    <PortalShell shopName={shopName}>
      <OrdersClient />
    </PortalShell>
  );
}
