import { NextRequest, NextResponse } from 'next/server'
import * as argon2 from 'argon2'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  supplierPayables,
  productStocks,
  auditLogs,
  users,
  ownerAssignments,
  eq,
  and,
  inArray,
} from '@/lib/db'
import { StockService } from '@/lib/services/stock-service'
import Big from 'big.js'

export const dynamic = 'force-dynamic'

const reverseSchema = z.object({
  pin: z.string().min(4).max(6),
  reason: z.string().min(1, 'Alasan pembatalan penerimaan wajib diisi'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission("po.approve");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID purchase order tidak valid' }, { status: 400 })
    }
    const poId = parseInt(id, 10)

    const body = await req.json().catch(() => ({}))
    const parsed = reverseSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { pin, reason } = parsed.data

    // Verifikasi PIN Owner
    const [ownerAssignment] = await db
      .select({ userId: ownerAssignments.userId })
      .from(ownerAssignments)
      .where(and(eq(ownerAssignments.branchId, payload.branchId), eq(ownerAssignments.isActive, true)))
      .limit(1)

    if (!ownerAssignment) {
      return NextResponse.json({ error: 'Owner tidak dikonfigurasi untuk cabang ini' }, { status: 404 })
    }

    const [owner] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, ownerAssignment.userId))
      .limit(1)

    if (!owner?.pinHash) {
      return NextResponse.json({ error: 'PIN Owner belum dikonfigurasi. Hubungi Administrator.' }, { status: 404 })
    }

    const isValidPin = await argon2.verify(owner.pinHash, pin)
    if (!isValidPin) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return NextResponse.json({ error: 'PIN Owner tidak valid. Pembatalan dibatalkan.' }, { status: 400 })
    }

    // Fetch PO + validasi
    const [po] = await db
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, branchId: purchaseOrders.branchId, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.branchId, payload.branchId)))
      .limit(1)

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order tidak ditemukan' }, { status: 404 })
    }
    if (po.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Hanya PO dengan status COMPLETED yang dapat dibatalkan penerimaannya' }, { status: 400 })
    }

    // Cek supplier payable — blokir jika sudah ada pembayaran
    const [payable] = await db
      .select({ id: supplierPayables.id, status: supplierPayables.status, paidAmount: supplierPayables.paidAmount })
      .from(supplierPayables)
      .where(eq(supplierPayables.poId, poId))
      .limit(1)

    if (payable && (payable.status !== 'UNPAID' || payable.paidAmount > 0)) {
      return NextResponse.json(
        { error: 'Tidak dapat membatalkan penerimaan: hutang supplier untuk PO ini sudah dibayar sebagian atau penuh' },
        { status: 400 }
      )
    }

    // Fetch PO items untuk reversal stok
    const items = await db
      .select({
        productId: purchaseOrderItems.productId,
        uomId: purchaseOrderItems.uomId,
        qtyReceived: purchaseOrderItems.qtyReceived,
        qtyDamaged: purchaseOrderItems.qtyDamaged,
        unitCost: purchaseOrderItems.unitCost,
        invoiceUnitCost: purchaseOrderItems.invoiceUnitCost,
      })
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.poId, poId))

    const productIds = Array.from(new Set(items.map((i) => i.productId)))

    await db.transaction(async (tx) => {
      // Pessimistic lock
      await tx
        .select({ id: productStocks.id })
        .from(productStocks)
        .where(and(inArray(productStocks.productId, productIds), eq(productStocks.branchId, po.branchId)))
        .for('update')

      // Deduct stok kembali (balik penambahan dari approve-receiving)
      for (const item of items) {
        const qtyNet = new Big(item.qtyReceived).minus(item.qtyDamaged)
        if (qtyNet.lte(0)) continue

        await StockService.deductStock(tx, po.branchId, item.productId, item.uomId, qtyNet.toNumber())
      }

      // Hapus supplier payable jika masih UNPAID dan belum ada pembayaran
      if (payable) {
        await tx.delete(supplierPayables).where(eq(supplierPayables.id, payable.id))
      }

      // Kembalikan status PO ke PARTIALLY_RECEIVED
      await tx
        .update(purchaseOrders)
        .set({ status: 'PARTIALLY_RECEIVED', updatedAt: new Date() })
        .where(eq(purchaseOrders.id, poId))

      // Audit log
      await tx.insert(auditLogs).values({
        branchId: po.branchId,
        userId: payload.userId,
        action: 'PO_RECEIVING_REVERSED',
        tableName: 'purchase_orders',
        recordId: String(poId),
        newData: JSON.stringify({ poNumber: po.poNumber, reason, reversedBy: payload.userId }),
      })
    })

    return NextResponse.json({ success: true, poNumber: po.poNumber })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membatalkan penerimaan barang'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
