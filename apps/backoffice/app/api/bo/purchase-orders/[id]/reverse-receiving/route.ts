import { StockConflictError } from '@/lib/services/stock-validation'
import { lockProductStocks } from '@/lib/services/stock-lock'
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
  stockShortfallClearings,
  auditLogs,
  users,
  ownerAssignments,
  eq,
  and,
  inArray,
  isNull,
} from '@/lib/db'
import { StockService } from '@/lib/services/stock-service'
import { proposeCostReversalForPO } from '@/lib/services/cost-sync-service'
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

    // PO ini sudah pernah melunasi shortfall (utang stok oversell) — reversal penuh (buka
    // lagi utangnya + balik true-up HPP) belum diimplementasikan, jadi diblokir dulu daripada
    // diam-diam meninggalkan ledger shortfall yang salah (lihat stock_shortfall_clearings).
    const priorClearings = await db
      .select({ id: stockShortfallClearings.id })
      .from(stockShortfallClearings)
      .where(and(
        eq(stockShortfallClearings.referenceType, 'PO_RECEIVING'),
        eq(stockShortfallClearings.referenceId, poId),
        isNull(stockShortfallClearings.reversedAt),
      ))
      .limit(1)
    if (priorClearings.length > 0) {
      return NextResponse.json(
        { error: 'PO ini sudah melunasi utang stok (shortfall), tidak bisa dibatalkan otomatis — perlu penyesuaian manual' },
        { status: 409 }
      )
    }

    await db.transaction(async (tx) => {
      const [lockedPo] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).for('update').limit(1)
      if (!lockedPo || lockedPo.status !== 'COMPLETED') throw new StockConflictError('Status PO berubah, penerimaan tidak dapat dibatalkan')
      const items = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
      const productIds = [...new Set(items.map(item => item.productId))]
      const [lockedPayable] = await tx.select().from(supplierPayables).where(eq(supplierPayables.poId, poId)).for('update').limit(1)
      if (lockedPayable && (lockedPayable.status !== 'UNPAID' || lockedPayable.paidAmount > 0)) throw new StockConflictError('Hutang supplier sudah dibayar, penerimaan tidak dapat dibatalkan')
      await lockProductStocks(tx, po.branchId, productIds)
      const clearings = await tx.select({ id: stockShortfallClearings.id }).from(stockShortfallClearings)
        .where(and(eq(stockShortfallClearings.referenceType, 'PO_RECEIVING'), eq(stockShortfallClearings.referenceId, poId), isNull(stockShortfallClearings.reversedAt))).limit(1)
      if (clearings.length > 0) throw new StockConflictError('PO sudah melunasi shortfall, pembatalan perlu penyesuaian manual')
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
      if (lockedPayable) {
        await tx.delete(supplierPayables).where(eq(supplierPayables.id, lockedPayable.id))
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

      // Modal yang tadinya ikut diperbarui PO ini tidak dikembalikan diam-diam — jadi usulan
      // di Tinjauan Modal yang harus disetujui OWNER/GM.
      await proposeCostReversalForPO(tx, {
        poId,
        poNumber: po.poNumber,
        branchId: po.branchId,
        actorUserId: payload.userId,
      })
    })

    return NextResponse.json({ success: true, poNumber: po.poNumber })
  } catch (error: unknown) {
    if (error instanceof StockConflictError) return NextResponse.json({ error: error.message }, { status: 409 })
    const message = error instanceof Error ? error.message : 'Gagal membatalkan penerimaan barang'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
