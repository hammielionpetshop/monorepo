import Big from 'big.js'
import {
  purchaseOrders,
  purchaseOrderItems,
  poReceivingLogs,
  poReceivingItems,
  supplierPayables,
  supplierReturns,
  productStockBatches,
  productStocks,
  products,
  unitsOfMeasure,
  stockShortfallClearings,
  auditLogs,
  eq,
  and,
  inArray,
  isNull,
  sql,
} from '../db'
import type { Tx } from '../stock-adjustment'
import { lockProductStocks } from './stock-lock'
import { proposeCostReversalForPO } from './cost-sync-service'

/** Status PO yang belum menyentuh stok/hutang — batal cukup mengganti status. */
export const OPEN_CANCELLABLE_STATUSES = ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'] as const

/** Retur supplier yang masih hidup (belum ditolak/ditarik/dibatalkan) mengikat stok & tagihan PO. */
const ACTIVE_RETURN_STATUSES = ['PENDING', 'APPROVED']

export class PoCancelError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message)
  }
}

export type CancelBlockerKind = 'PAID' | 'RETURN' | 'SHORTFALL' | 'NO_BATCH' | 'USED'

/** Satu alasan PO Selesai belum bisa dibatalkan, beserta langkah yang harus dilakukan admin. */
export interface CancelBlocker {
  kind: CancelBlockerKind
  message: string
  action: string
}

export interface BatchUsage {
  productId: number
  productName: string
  uomCode: string
  /** Qty bersih yang diterima PO ini (satuan dasar). */
  qtyIn: number
  /** Sisa batch milik PO ini yang belum terpakai (satuan dasar). */
  qtyRemaining: number
  hasBatch: boolean
}

export interface CompletedCancelFacts {
  paidAmount: number
  activeReturns: { returnNumber: string; status: string }[]
  hasShortfallClearing: boolean
  usage: BatchUsage[]
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

/**
 * Syarat pembatalan PO Selesai (keputusan owner 2026-11-05): ditolak bila hutangnya sudah dibayar,
 * ada retur supplier aktif, PO sudah melunasi utang stok, atau stok dari PO itu sudah terpakai.
 * Fungsi murni supaya layar panduan dan proses batal memakai aturan yang sama.
 */
export function completedCancelBlockers(facts: CompletedCancelFacts): CancelBlocker[] {
  const blockers: CancelBlocker[] = []

  if (facts.paidAmount > 0) {
    blockers.push({
      kind: 'PAID',
      message: `Hutang supplier PO ini sudah dibayar ${rupiah(facts.paidAmount)}.`,
      action:
        'Uang yang sudah dibayar tidak bisa ditarik lewat pembatalan PO. Kembalikan barangnya lewat menu Retur Supplier — nilainya memotong tagihan atau menjadi saldo supplier.',
    })
  }

  if (facts.activeReturns.length > 0) {
    const list = facts.activeReturns
      .map(r => `${r.returnNumber} (${r.status === 'PENDING' ? 'menunggu' : 'disetujui'})`)
      .join(', ')
    blockers.push({
      kind: 'RETURN',
      message: `Ada retur supplier untuk PO ini: ${list}.`,
      action: 'Tarik atau tolak retur yang menunggu, atau batalkan retur yang sudah disetujui, di menu Retur Supplier. Setelah itu buka lagi halaman ini.',
    })
  }

  if (facts.hasShortfallClearing) {
    blockers.push({
      kind: 'SHORTFALL',
      message: 'Barang dari PO ini sudah dipakai untuk menutup stok minus (barang terjual sebelum stoknya masuk).',
      action: 'Pembatalan otomatis tidak bisa dilakukan. Hubungi Owner untuk koreksi lewat Stock Opname / penyesuaian stok.',
    })
  }

  const missing = facts.usage.filter(u => !u.hasBatch)
  if (missing.length > 0) {
    blockers.push({
      kind: 'NO_BATCH',
      message: `PO lama tanpa catatan batch untuk: ${missing.map(u => u.productName).join(', ')}.`,
      action: 'Stok PO ini tidak bisa dilacak per batch. Hubungi Owner untuk koreksi lewat Stock Opname / penyesuaian stok.',
    })
  }

  const used = facts.usage.filter(u => u.hasBatch && u.qtyRemaining < u.qtyIn)
  if (used.length > 0) {
    const list = used
      .map(u => `${u.productName}: masuk ${u.qtyIn} ${u.uomCode}, tersisa ${u.qtyRemaining} ${u.uomCode}`)
      .join('; ')
    blockers.push({
      kind: 'USED',
      message: `Sebagian barang dari PO ini sudah terpakai (terjual, dipindah, atau dipotong opname) — ${list}.`,
      action: 'PO yang barangnya sudah terpakai tidak bisa dibatalkan. Untuk sisa barang yang salah, kembalikan ke supplier lewat menu Retur Supplier atau koreksi lewat Stock Opname.',
    })
  }

  return blockers
}

async function loadCompletedFacts(tx: Tx, po: { id: number; branchId: number }, paidAmount: number): Promise<CompletedCancelFacts> {
  const activeReturns = await tx
    .select({ returnNumber: supplierReturns.returnNumber, status: supplierReturns.status })
    .from(supplierReturns)
    .where(and(eq(supplierReturns.poId, po.id), inArray(supplierReturns.status, ACTIVE_RETURN_STATUSES)))

  const [clearing] = await tx
    .select({ id: stockShortfallClearings.id })
    .from(stockShortfallClearings)
    .where(and(
      eq(stockShortfallClearings.referenceType, 'PO_RECEIVING'),
      eq(stockShortfallClearings.referenceId, po.id),
      isNull(stockShortfallClearings.reversedAt),
    ))
    .limit(1)

  const items = await tx
    .select({
      productId: purchaseOrderItems.productId,
      qtyReceived: purchaseOrderItems.qtyReceived,
      qtyDamaged: purchaseOrderItems.qtyDamaged,
      productName: products.name,
      uomCode: unitsOfMeasure.code,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
    .where(eq(purchaseOrderItems.poId, po.id))

  const batches = await tx
    .select({
      productId: productStockBatches.productId,
      qtyReceived: productStockBatches.qtyReceived,
      qtyRemaining: productStockBatches.qtyRemaining,
    })
    .from(productStockBatches)
    .where(and(eq(productStockBatches.purchaseOrderId, po.id), eq(productStockBatches.branchId, po.branchId)))

  const usage = new Map<number, BatchUsage>()
  for (const item of items) {
    const net = new Big(item.qtyReceived).minus(item.qtyDamaged)
    if (net.lte(0)) continue
    if (!usage.has(item.productId)) {
      usage.set(item.productId, {
        productId: item.productId,
        productName: item.productName,
        uomCode: item.uomCode ?? '',
        qtyIn: 0,
        qtyRemaining: 0,
        hasBatch: false,
      })
    }
  }
  for (const batch of batches) {
    const row = usage.get(batch.productId)
    if (!row) continue
    row.hasBatch = true
    row.qtyIn += batch.qtyReceived
    row.qtyRemaining += batch.qtyRemaining
  }

  return { paidAmount, activeReturns, hasShortfallClearing: Boolean(clearing), usage: [...usage.values()] }
}

function scopedPoWhere(poId: number, scopeBranchId: number | null) {
  return scopeBranchId === null
    ? eq(purchaseOrders.id, poId)
    : and(eq(purchaseOrders.id, poId), eq(purchaseOrders.branchId, scopeBranchId))
}

/** Periksa syarat batal PO Selesai tanpa mengubah apa pun — dipakai layar panduan. */
export async function checkCompletedCancellation(tx: Tx, poId: number, scopeBranchId: number | null) {
  const [po] = await tx.select().from(purchaseOrders).where(scopedPoWhere(poId, scopeBranchId)).limit(1)
  if (!po) throw new PoCancelError('Purchase Order tidak ditemukan', 404)
  if (po.status !== 'COMPLETED') return { status: po.status, blockers: [] as CancelBlocker[], usage: [] as BatchUsage[] }
  const [payable] = await tx
    .select({ paidAmount: supplierPayables.paidAmount, totalAmount: supplierPayables.totalAmount, status: supplierPayables.status })
    .from(supplierPayables)
    .where(eq(supplierPayables.poId, poId))
    .limit(1)
  const facts = await loadCompletedFacts(tx, po, payable?.paidAmount ?? 0)
  return {
    status: po.status,
    blockers: completedCancelBlockers(facts),
    usage: facts.usage,
    payable: payable && payable.status !== 'WAIVED' ? { totalAmount: payable.totalAmount } : null,
  }
}

interface CancelInput {
  poId: number
  actorUserId: number
  reason: string
  /** null = OWNER/GM lintas cabang. */
  scopeBranchId: number | null
}

/**
 * Batalkan PO yang belum menyentuh stok (Disetujui, Dalam Pengiriman, atau Diterima tapi belum
 * disetujui). Input penerimaan yang belum disetujui dibersihkan seperti "Batalkan Input
 * Penerimaan" — salinannya disimpan di audit log.
 */
export async function cancelOpenPurchaseOrder(tx: Tx, input: CancelInput) {
  const [po] = await tx.select().from(purchaseOrders).where(scopedPoWhere(input.poId, input.scopeBranchId)).for('update').limit(1)
  if (!po) throw new PoCancelError('Purchase Order tidak ditemukan', 404)
  if (!(OPEN_CANCELLABLE_STATUSES as readonly string[]).includes(po.status)) {
    throw new PoCancelError(
      po.status === 'COMPLETED'
        ? 'Stok PO ini sudah masuk — gunakan pembatalan PO Selesai (perlu PIN Owner)'
        : 'PO dengan status ini tidak bisa dibatalkan',
    )
  }

  const [payable] = await tx.select({ id: supplierPayables.id }).from(supplierPayables).where(eq(supplierPayables.poId, po.id)).limit(1)
  const [batch] = await tx.select({ id: productStockBatches.id }).from(productStockBatches).where(eq(productStockBatches.purchaseOrderId, po.id)).limit(1)
  if (payable || batch) throw new PoCancelError('Stok atau hutang PO ini sudah dibuat — gunakan pembatalan PO Selesai')

  const items = await tx
    .select({ id: purchaseOrderItems.id, productId: purchaseOrderItems.productId, qtyReceived: purchaseOrderItems.qtyReceived, qtyDamaged: purchaseOrderItems.qtyDamaged })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.poId, po.id))

  const logs = await tx.select({ id: poReceivingLogs.id }).from(poReceivingLogs).where(eq(poReceivingLogs.poId, po.id))
  const logIds = logs.map(l => l.id)
  if (logIds.length > 0) {
    await tx.delete(poReceivingItems).where(inArray(poReceivingItems.logId, logIds))
    await tx.delete(poReceivingLogs).where(inArray(poReceivingLogs.id, logIds))
    await tx.update(purchaseOrderItems).set({ qtyReceived: 0, qtyDamaged: 0, expiryDate: null }).where(eq(purchaseOrderItems.poId, po.id))
  }

  await tx.update(purchaseOrders).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(purchaseOrders.id, po.id))

  await tx.insert(auditLogs).values({
    branchId: po.branchId,
    userId: input.actorUserId,
    action: 'PO_CANCELLED',
    tableName: 'purchase_orders',
    recordId: String(po.id),
    oldData: JSON.stringify({ status: po.status, receivingLogIds: logIds, items }),
    newData: JSON.stringify({ status: 'CANCELLED', poNumber: po.poNumber, reason: input.reason, stockReversed: false }),
  })

  return { poNumber: po.poNumber, previousStatus: po.status }
}

/**
 * Batalkan PO Selesai: stok yang masuk dari PO ini ditarik dari batch milik PO itu sendiri
 * (bukan FIFO batch terlama), hutang yang belum dibayar ditandai Dihapus, perubahan modal
 * diusulkan kembali lewat Tinjauan Modal, dan PO ditutup Dibatalkan.
 */
export async function cancelCompletedPurchaseOrder(tx: Tx, input: CancelInput) {
  const [po] = await tx.select().from(purchaseOrders).where(scopedPoWhere(input.poId, input.scopeBranchId)).for('update').limit(1)
  if (!po) throw new PoCancelError('Purchase Order tidak ditemukan', 404)
  if (po.status !== 'COMPLETED') throw new PoCancelError('Status PO berubah — muat ulang halaman')

  const [payable] = await tx.select().from(supplierPayables).where(eq(supplierPayables.poId, po.id)).for('update').limit(1)

  const productIds = (await tx
    .select({ productId: purchaseOrderItems.productId })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.poId, po.id))).map(r => r.productId)
  await lockProductStocks(tx, po.branchId, productIds)

  const facts = await loadCompletedFacts(tx, po, payable?.paidAmount ?? 0)
  const blockers = completedCancelBlockers(facts)
  if (blockers.length > 0) throw new PoCancelError(blockers.map(b => b.message).join(' '))

  const batches = await tx
    .select()
    .from(productStockBatches)
    .where(and(eq(productStockBatches.purchaseOrderId, po.id), eq(productStockBatches.branchId, po.branchId)))
    .for('update')

  const removedByProduct = new Map<number, number>()
  for (const batch of batches) {
    if (batch.qtyRemaining <= 0) continue
    const changed = await tx
      .update(productStockBatches)
      .set({ qtyRemaining: 0 })
      .where(and(eq(productStockBatches.id, batch.id), eq(productStockBatches.qtyRemaining, batch.qtyReceived)))
      .returning({ id: productStockBatches.id })
    if (changed.length !== 1) throw new PoCancelError('Stok berubah saat diproses — muat ulang halaman lalu coba lagi')
    removedByProduct.set(batch.productId, (removedByProduct.get(batch.productId) ?? 0) + batch.qtyRemaining)
  }

  if (removedByProduct.size > 0) {
    const baseRows = await tx
      .select({ id: products.id, baseUomId: products.baseUomId })
      .from(products)
      .where(inArray(products.id, [...removedByProduct.keys()]))
    for (const { id: productId, baseUomId } of baseRows) {
      const qty = removedByProduct.get(productId) ?? 0
      const changed = await tx
        .update(productStocks)
        .set({ qty: sql`${productStocks.qty} - ${qty}` })
        .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, po.branchId), eq(productStocks.uomId, baseUomId)))
        .returning({ id: productStocks.id })
      if (changed.length !== 1) throw new PoCancelError('Data stok produk tidak ditemukan — hubungi Administrator', 500)
    }
  }

  if (payable && payable.status !== 'WAIVED') {
    await tx.update(supplierPayables).set({ status: 'WAIVED' }).where(eq(supplierPayables.id, payable.id))
  }

  await proposeCostReversalForPO(tx, { poId: po.id, poNumber: po.poNumber, branchId: po.branchId, actorUserId: input.actorUserId })

  await tx.update(purchaseOrders).set({ status: 'CANCELLED', updatedAt: new Date() }).where(eq(purchaseOrders.id, po.id))

  await tx.insert(auditLogs).values({
    branchId: po.branchId,
    userId: input.actorUserId,
    action: 'PO_CANCELLED',
    tableName: 'purchase_orders',
    recordId: String(po.id),
    oldData: JSON.stringify({
      status: po.status,
      payable: payable ? { id: payable.id, status: payable.status, totalAmount: payable.totalAmount } : null,
      batches: batches.map(b => ({ id: b.id, productId: b.productId, qtyRemaining: b.qtyRemaining })),
    }),
    newData: JSON.stringify({
      status: 'CANCELLED',
      poNumber: po.poNumber,
      reason: input.reason,
      stockReversed: true,
      removedByProduct: Object.fromEntries(removedByProduct),
    }),
  })

  return { poNumber: po.poNumber, previousStatus: po.status }
}
