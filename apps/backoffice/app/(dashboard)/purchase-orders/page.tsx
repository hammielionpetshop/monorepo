import { db, purchaseOrders, suppliers, branches, desc, eq, and } from '@/lib/db';
import { POListClient } from './_components/po-list-client';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage() {
  let pos: any[] = [];
  let error: string | null = null;

  try {
    const rows = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        targetDeliveryDate: purchaseOrders.targetDeliveryDate,
        createdAt: purchaseOrders.createdAt,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        branchId: purchaseOrders.branchId,
        branchName: branches.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .orderBy(desc(purchaseOrders.createdAt));

    pos = rows.map(r => ({
      ...r,
      supplier: { id: r.supplierId, name: r.supplierName ?? '-' },
      branch: { id: r.branchId, name: r.branchName ?? '-' },
    }));
  } catch (e) {
    console.error('PurchaseOrdersPage error:', e);
    error = 'Terjadi kesalahan saat mengambil data Purchase Order';
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola dan setujui permintaan pembelian dari semua cabang
          </p>
        </div>
      </div>
      <POListClient pos={pos} />
    </div>
  );
}
