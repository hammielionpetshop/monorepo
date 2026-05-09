import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { db, purchaseOrders, purchaseOrderItems, suppliers, branches, products, unitsOfMeasure, eq } from '@/lib/db';
import { notFound } from 'next/navigation';
import { PODetailClient } from './_components/po-detail-client';

export const dynamic = 'force-dynamic';

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const poId = parseInt(id);

  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const currentUserId = (payload as any)?.userId ?? (payload as any)?.id ?? 1;
  const role = (payload as any)?.role ?? 'OWNER';

  let po: any = null;
  let error: string | null = null;

  try {
    const [poRows, itemRows] = await Promise.all([
      db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          status: purchaseOrders.status,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          rejectionNote: purchaseOrders.rejectionNote,
          invoiceNumber: purchaseOrders.invoiceNumber,
          targetDeliveryDate: purchaseOrders.targetDeliveryDate,
          approvedAt: purchaseOrders.approvedAt,
          createdAt: purchaseOrders.createdAt,
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
        })
        .from(purchaseOrderItems)
        .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(purchaseOrderItems.uomId, unitsOfMeasure.id))
        .where(eq(purchaseOrderItems.poId, poId)),
    ]);

    if (!poRows[0]) return notFound();

    const row = poRows[0];
    po = {
      ...row,
      supplier: { id: row.supplierId, name: row.supplierName ?? '-', phone: row.supplierPhone },
      branch: { id: row.branchId, name: row.branchName ?? '-' },
      items: itemRows,
    };
  } catch (e) {
    console.error('PODetailPage error:', e);
    error = 'Terjadi kesalahan saat mengambil data';
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <PODetailClient po={po} currentUserId={currentUserId} role={role} />
    </div>
  );
}
