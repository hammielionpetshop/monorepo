import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth';
import {
  db, purchaseOrders, purchaseOrderItems, purchaseOrderUnloadings, poReceivingLogs, suppliers, branches, products, unitsOfMeasure,
  eq, and, desc, inArray,
} from '@/lib/db';
import { ReceivePOClient } from './_components/receive-po-client';
import { loadLastCosts, lastCostKey } from '@/lib/po-last-cost';

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
        unitCost: purchaseOrderItems.unitCost,
        invoiceUnitCost: purchaseOrderItems.invoiceUnitCost,
        qtyUnloaded: purchaseOrderItems.qtyUnloaded,
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

  const [lastCosts, [lastUnloading], [lastReceiving]] = await Promise.all([
    loadLastCosts(row.branchId, itemRows),
    db
      .select({ reportNumber: purchaseOrderUnloadings.reportNumber, createdAt: purchaseOrderUnloadings.createdAt })
      .from(purchaseOrderUnloadings)
      .where(and(eq(purchaseOrderUnloadings.poId, poId), inArray(purchaseOrderUnloadings.action, ['CREATED', 'REPLACED', 'MATCHED'])))
      .orderBy(desc(purchaseOrderUnloadings.id))
      .limit(1),
    db
      .select({ receivedAt: poReceivingLogs.receivedAt })
      .from(poReceivingLogs)
      .where(eq(poReceivingLogs.poId, poId))
      .orderBy(desc(poReceivingLogs.receivedAt))
      .limit(1),
  ]);
  // Jumlah bongkaran hanya mengisi penerimaan pertama sesudah laporan itu dikirim; penerimaan
  // berikutnya kembali kosong supaya tidak dihitung dua kali.
  const unloadingFresh = lastUnloading && (!lastReceiving || lastReceiving.receivedAt < lastUnloading.createdAt);

  const po = {
    id: row.id,
    poNumber: row.poNumber,
    status: row.status,
    totalAmount: row.totalAmount,
    supplier: { id: row.supplierId, name: row.supplierName ?? '-', phone: row.supplierPhone },
    branch: { id: row.branchId, name: row.branchName ?? '-' },
    unloadingNumber: unloadingFresh ? lastUnloading.reportNumber : null,
    items: itemRows.map(({ qtyUnloaded, ...item }) => ({
      ...item,
      lastCost: lastCosts.get(lastCostKey(item.productId, item.uomId)) ?? null,
      unloadedPrefill: unloadingFresh && qtyUnloaded != null
        ? Math.max(Math.min(qtyUnloaded, item.qtyOrdered - item.qtyReceived), 0)
        : null,
    })),
  };

  return (
    <div className="p-6 max-w-6xl">
      <ReceivePOClient po={po} />
    </div>
  );
}
