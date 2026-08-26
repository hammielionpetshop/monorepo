import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth';
import { db, purchaseOrders, purchaseOrderItems, suppliers, branches, products, unitsOfMeasure, eq } from '@/lib/db';
import { ReceivePOClient } from './_components/receive-po-client';

export const dynamic = 'force-dynamic';

const RECEIVABLE_STATUSES = ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'];

export default async function ReceivePOPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poId = parseInt(id);

  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const role = (payload as any)?.role ?? '';

  if (!['OWNER', 'GM'].includes(role)) {
    redirect(`/purchase-orders/${poId}`);
  }

  const [poRows, itemRows] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        supplierPhone: suppliers.phone,
        branchId: purchaseOrders.branchId,
        branchName: branches.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .where(eq(purchaseOrders.id, poId))
      .limit(1),
    db
      .select({
        id: purchaseOrderItems.id,
        productId: purchaseOrderItems.productId,
        productName: products.name,
        productSku: products.sku,
        uomId: purchaseOrderItems.uomId,
        uomCode: unitsOfMeasure.code,
        qtyOrdered: purchaseOrderItems.qtyOrdered,
        qtyReceived: purchaseOrderItems.qtyReceived,
        qtyDamaged: purchaseOrderItems.qtyDamaged,
      })
      .from(purchaseOrderItems)
      .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
      .leftJoin(unitsOfMeasure, eq(purchaseOrderItems.uomId, unitsOfMeasure.id))
      .where(eq(purchaseOrderItems.poId, poId)),
  ]);

  if (!poRows[0]) return notFound();

  const row = poRows[0];

  if (!RECEIVABLE_STATUSES.includes(row.status)) {
    redirect(`/purchase-orders/${poId}`);
  }

  const po = {
    id: row.id,
    poNumber: row.poNumber,
    status: row.status,
    totalAmount: row.totalAmount,
    supplier: { id: row.supplierId, name: row.supplierName ?? '-', phone: row.supplierPhone },
    branch: { id: row.branchId, name: row.branchName ?? '-' },
    items: itemRows,
  };

  return (
    <div className="p-6 max-w-3xl">
      <ReceivePOClient po={po} />
    </div>
  );
}
