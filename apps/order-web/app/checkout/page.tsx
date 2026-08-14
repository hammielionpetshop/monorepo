import { getShopName } from '@/lib/shop-name';
import { PortalShell } from '../_components/portal-shell';
import { CheckoutClient } from '../_components/checkout-client';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const shopName = await getShopName();

  return (
    <PortalShell shopName={shopName}>
      <CheckoutClient />
    </PortalShell>
  );
}
