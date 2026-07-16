import { db, eq, branches } from '@/lib/db';
import { orderBranchId } from '@/lib/services/catalog-service';
import { PortalShell } from '../_components/portal-shell';
import { OrdersClient } from '../_components/orders-client';

async function getShopName() {
  const [branch] = await db
    .select({ receiptName: branches.receiptName })
    .from(branches)
    .where(eq(branches.id, orderBranchId()))
    .limit(1);
  return branch?.receiptName ?? 'Hammielion';
}

export default async function OrdersPage() {
  const shopName = await getShopName();

  return (
    <PortalShell shopName={shopName}>
      <OrdersClient />
    </PortalShell>
  );
}
