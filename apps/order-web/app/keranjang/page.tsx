import { getShopName } from '@/lib/shop-name';
import { PortalShell } from '../_components/portal-shell';
import { CartClient } from '../_components/cart-client';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const shopName = await getShopName();

  return (
    <PortalShell shopName={shopName}>
      <CartClient />
    </PortalShell>
  );
}
