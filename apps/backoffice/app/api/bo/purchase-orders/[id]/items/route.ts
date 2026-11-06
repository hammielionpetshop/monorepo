import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/authz';
import { db, purchaseOrders, purchaseOrderItems, auditLogs, eq, and } from '@/lib/db';
import { serviceProductMessage } from '@/lib/service-product-guard';

export const dynamic = 'force-dynamic';

const schema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    uomId: z.number().int().positive(),
    qtyOrdered: z.number().int().positive('Jumlah harus lebih dari 0'),
    unitCost: z.number().int().nonnegative('Harga tidak boleh minus'),
  })).min(1, 'Draft PO minimal berisi satu barang'),
});

/**
 * Ubah isi Draft PO (tambah/hapus barang, jumlah, harga) — hanya status DRAFT, belum menyentuh stok
 * atau hutang (keputusan owner 2026-11-06 butir 4). Jumlah bongkaran (`qty_unloaded`) per produk +
 * satuan dipertahankan sebagai pembanding.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('po.manage');
  if (gate instanceof NextResponse) return gate;
  const payload = gate;
  const poId = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(poId) || poId <= 0) return NextResponse.json({ error: 'ID Purchase Order tidak valid' }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 });
  const { items } = parsed.data;
  if (new Set(items.map((i) => `${i.productId}:${i.uomId}`)).size !== items.length) {
    return NextResponse.json({ error: 'Produk + satuan yang sama muncul dua kali' }, { status: 400 });
  }
  const serviceMessage = await serviceProductMessage(items.map((i) => i.productId));
  if (serviceMessage) return NextResponse.json({ error: serviceMessage }, { status: 400 });

  const where = payload.branchScope === 'ALL'
    ? eq(purchaseOrders.id, poId)
    : and(eq(purchaseOrders.id, poId), eq(purchaseOrders.branchId, payload.branchId));

  try {
    const result = await db.transaction(async (tx) => {
      const [po] = await tx.select({ id: purchaseOrders.id, status: purchaseOrders.status }).from(purchaseOrders).where(where).for('update').limit(1);
      if (!po) return { status: 404, error: 'Purchase Order tidak ditemukan' } as const;
      if (po.status !== 'DRAFT') return { status: 409, error: 'Isi PO hanya bisa diubah selama masih Draft' } as const;
      const old = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
      const unloaded = new Map(old.map((o) => [`${o.productId}:${o.uomId}`, o.qtyUnloaded]));
      await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
      await tx.insert(purchaseOrderItems).values(items.map((i) => ({
        poId, productId: i.productId, uomId: i.uomId, qtyOrdered: i.qtyOrdered, qtyReceived: 0, qtyDamaged: 0,
        unitCost: i.unitCost, qtyUnloaded: unloaded.get(`${i.productId}:${i.uomId}`) ?? null,
      })));
      const total = items.reduce((sum, i) => sum + i.qtyOrdered * i.unitCost, 0);
      await tx.update(purchaseOrders).set({ totalAmount: total, updatedAt: new Date() }).where(eq(purchaseOrders.id, poId));
      await tx.insert(auditLogs).values({
        userId: payload.userId, action: 'PO_DRAFT_ITEMS_UPDATED', tableName: 'purchase_orders', recordId: String(poId),
        oldData: JSON.stringify(old.map((o) => ({ productId: o.productId, uomId: o.uomId, qtyOrdered: o.qtyOrdered, unitCost: o.unitCost }))),
        newData: JSON.stringify(items),
      });
      return { status: 200, total } as const;
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, totalAmount: result.total });
  } catch (error) {
    console.error('Ubah isi Draft PO gagal:', error);
    return NextResponse.json({ error: 'Gagal mengubah isi Draft PO' }, { status: 500 });
  }
}
