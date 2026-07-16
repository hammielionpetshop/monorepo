import { db, eq, branches } from '@/lib/db';
import { orderBranchId } from '@/lib/services/catalog-service';
import { PortalShell } from '../../_components/portal-shell';
import { OrderDetailClient } from '../../_components/order-detail-client';

async function getShopName() {
  const [branch] = await db
    .select({ receiptName: branches.receiptName })
    .from(branches)
    .where(eq(branches.id, orderBranchId()))
    .limit(1);
  return branch?.receiptName ?? 'Hammielion';
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shopName = await getShopName();

  return (
    <PortalShell shopName={shopName}>
      <OrderDetailClient orderId={Number(id)} />
    </PortalShell>
  );
}
