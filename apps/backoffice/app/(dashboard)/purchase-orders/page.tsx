import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { db, purchaseOrders, suppliers, branches, desc, eq, and } from '@/lib/db';
import { POListClient } from './_components/po-list-client';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  const payload = token ? await verifyAccessToken(token) : null;
  const currentUserId = (payload as any)?.userId ?? 1;
  const role = (payload as any)?.role ?? 'GUEST';

  let pos: any[] = [];
  let suppliersList: any[] = [];
  let branchesList: any[] = [];
  let error: string | null = null;

  try {
    [pos, suppliersList, branchesList] = await Promise.all([
      db
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
        .orderBy(desc(purchaseOrders.createdAt)),

      db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name),

      db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name),
    ]);

    pos = pos.map(r => ({
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
      <POListClient
        pos={pos}
        suppliers={suppliersList}
        branches={branchesList}
        currentUserId={currentUserId}
        role={role}
      />
    </div>
  );
}
