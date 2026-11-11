import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { restoreCostBeforePO } from '@/lib/services/cost-sync-service'
import { db, purchaseOrders, products, auditLogs, eq, inArray } from '@/lib/db'

export const dynamic = 'force-dynamic'

const restoreSchema = z.object({
  reason: z
    .string({ message: 'Alasan wajib diisi' })
    .trim()
    .min(5, 'Alasan wajib diisi (minimal 5 huruf)')
    .max(500, 'Alasan maksimal 500 karakter'),
})

class RestoreError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// Kembalikan Modal: modal barang-barang di PO Selesai kembali ke angka sebelum PO itu masuk, tanpa
// mengubah harga PO, hutang, maupun HPP batch. PO lalu ditandai keep_current_cost supaya perubahan
// harga faktur berikutnya tidak menaikkan modal lagi. Hak po.returned_goods (OWNER/GM).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('po.returned_goods')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id } = await params
    const poId = Number.parseInt(id, 10)
    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json({ error: 'ID purchase order tidak valid' }, { status: 400 })
    }
    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }
    const parsed = restoreSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { reason } = parsed.data

    const result = await db.transaction(async (tx) => {
      const [po] = await tx
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          branchId: purchaseOrders.branchId,
          status: purchaseOrders.status,
          keepCurrentCost: purchaseOrders.keepCurrentCost,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, poId))
        .for('update')
        .limit(1)

      if (!po) throw new RestoreError('Purchase Order tidak ditemukan', 404)
      if (payload.branchScope !== 'ALL' && payload.branchId !== po.branchId) {
        throw new RestoreError('Akses ditolak. PO ini milik cabang lain.', 403)
      }
      if (po.status !== 'COMPLETED') {
        throw new RestoreError('Modal hanya bisa dikembalikan dari PO yang sudah Selesai', 409)
      }
      if (po.keepCurrentCost) {
        throw new RestoreError('PO ini sudah tidak mengubah modal (Barang kembali / modal sudah dikembalikan)', 409)
      }

      const restore = await restoreCostBeforePO(tx, {
        poId: po.id,
        poNumber: po.poNumber,
        branchId: po.branchId,
        actorUserId: payload.userId,
        reason,
      })

      await tx
        .update(purchaseOrders)
        .set({ keepCurrentCost: true, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, po.id))

      await tx.insert(auditLogs).values({
        branchId: po.branchId,
        userId: payload.userId,
        action: 'PO_COST_RESTORED',
        tableName: 'purchase_orders',
        recordId: String(po.id),
        oldData: JSON.stringify({ keepCurrentCost: false }),
        newData: JSON.stringify({ poNumber: po.poNumber, reason, keepCurrentCost: true, ...restore }),
      })

      return restore
    })

    const ids = [...result.restored, ...result.pendingClosed, ...result.skipped.map((s) => s.productId)]
    const names = new Map<number, string>()
    if (ids.length > 0) {
      const rows = await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, ids))
      for (const r of rows) names.set(r.id, r.name)
    }
    const nameOf = (productId: number) => names.get(productId) ?? `Produk #${productId}`

    return NextResponse.json({
      restored: result.restored.map(nameOf),
      pendingClosed: result.pendingClosed.map(nameOf),
      skipped: result.skipped.map((s) => ({ name: nameOf(s.productId), reason: s.reason })),
    })
  } catch (error) {
    if (error instanceof RestoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST purchase-orders restore-cost error:', error)
    return NextResponse.json({ error: 'Gagal mengembalikan modal' }, { status: 500 })
  }
}
