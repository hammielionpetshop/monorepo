import Big from 'big.js'
import { z } from 'zod'
import {
  db,
  supplierReturns,
  supplierReturnItems,
  supplierCreditEntries,
  supplierPayables,
  supplierPayablePayments,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  productUomCosts,
  auditLogs,
  eq,
  and,
  ne,
  inArray,
  like,
  desc,
  sql,
} from '@/lib/db'
import { poDateStr, isUniqueViolation } from '@/lib/po-number'
import { lockProductStocks } from '@/lib/services/stock-lock'
import { StockService, InsufficientStockError } from '@/lib/services/stock-service'
import { StockConflictError } from '@/lib/services/stock-validation'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

export const SUPPLIER_RETURN_REASONS = ['EXPIRED', 'RUSAK', 'SALAH_KIRIM', 'LAINNYA'] as const
export type SupplierReturnReason = (typeof SUPPLIER_RETURN_REASONS)[number]

export const SUPPLIER_RETURN_REASON_LABELS: Record<SupplierReturnReason, string> = {
  EXPIRED: 'Kadaluarsa',
  RUSAK: 'Rusak',
  SALAH_KIRIM: 'Salah Kirim',
  LAINNYA: 'Lainnya',
}

/** Metode baris `supplier_payable_payments` yang dibuat retur (potong tagihan). */
export const PAYMENT_METHOD_RETUR = 'RETUR'
/** Metode baris `supplier_payable_payments` yang dibayar dari saldo supplier. */
export const PAYMENT_METHOD_SALDO = 'SALDO SUPPLIER'

export class SupplierReturnError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'SupplierReturnError'
  }
}

export const supplierReturnRequestSchema = z.object({
  supplierId: z.number().int().positive('Pilih supplier'),
  poId: z.number().int().positive().nullable().optional(),
  reason: z.enum(SUPPLIER_RETURN_REASONS, { message: 'Alasan tidak valid' }),
  notes: z.string().trim().min(5, 'Jelaskan alasan retur (minimal 5 huruf)').max(500, 'Penjelasan maksimal 500 karakter'),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        uomId: z.number().int().positive(),
        poItemId: z.number().int().positive().nullable().optional(),
        qty: z.number().int().positive('Qty harus lebih dari 0'),
        photoUrl: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1, 'Minimal satu barang yang diretur')
    .max(100, 'Maksimal 100 barang per retur'),
})
export type SupplierReturnRequest = z.infer<typeof supplierReturnRequestSchema>

export const supplierReturnApproveSchema = z.object({
  // Harga klaim per satuan untuk barang TANPA PO asal — boleh diubah penyetuju
  // (modal terakhir bisa saja bukan harga yang disepakati dengan supplier).
  prices: z
    .array(z.object({ itemId: z.number().int().positive(), unitPrice: z.number().int().min(0) }))
    .optional(),
})

/** Harga klaim per satuan dari baris PO: harga faktur bila sudah diisi, kalau belum harga PO. */
export function poItemClaimPrice(item: { unitCost: number; invoiceUnitCost: number | null }): number | null {
  // invoice_unit_cost = 0 → "menunggu faktur" (alur PO 1.107.56): harganya belum diketahui,
  // dan tagihannya pun masih Rp 0 untuk barang itu — retur belum bisa dinilai.
  if (item.invoiceUnitCost === 0) return null
  return item.invoiceUnitCost ?? item.unitCost
}

/**
 * Pembagian nilai retur yang disetujui: potong sisa tagihan PO asal lebih dulu, sisanya
 * (PO sudah lunas / dihapus / retur tanpa PO) jadi saldo supplier.
 */
export function splitReturnValue(
  totalValue: number,
  payable: { totalAmount: number; paidAmount: number; status: string } | null,
): { payableDeduction: number; creditAmount: number } {
  const open = payable && payable.status !== 'PAID' && payable.status !== 'WAIVED'
  const remaining = open ? Math.max(0, payable.totalAmount - payable.paidAmount) : 0
  const payableDeduction = Math.min(totalValue, remaining)
  return { payableDeduction, creditAmount: totalValue - payableDeduction }
}

async function generateReturnNumber(executor: Executor, now = new Date()): Promise<string> {
  const dateStr = poDateStr(now)
  const [last] = await executor
    .select({ returnNumber: supplierReturns.returnNumber })
    .from(supplierReturns)
    .where(like(supplierReturns.returnNumber, `RS-${dateStr}-%`))
    .orderBy(desc(supplierReturns.returnNumber))
    .limit(1)
  const lastSeq = Number.parseInt(last?.returnNumber.split('-')[2] ?? '', 10)
  const next = Number.isInteger(lastSeq) && lastSeq > 0 ? lastSeq + 1 : 1
  return `RS-${dateStr}-${next.toString().padStart(4, '0')}`
}

/**
 * Qty per baris PO yang sudah/sedang diretur (PENDING + APPROVED), supaya satu barang PO
 * tidak bisa diretur melebihi yang diterima. `excludeReturnId` = retur yang sedang diproses.
 */
async function returnedQtyByPoItem(executor: Executor, poItemIds: number[], excludeReturnId?: number) {
  const map = new Map<number, number>()
  if (poItemIds.length === 0) return map
  const rows = await executor
    .select({
      poItemId: supplierReturnItems.poItemId,
      qty: sql<number>`CAST(SUM(${supplierReturnItems.qty}) AS INTEGER)`,
    })
    .from(supplierReturnItems)
    .innerJoin(supplierReturns, eq(supplierReturnItems.supplierReturnId, supplierReturns.id))
    .where(and(
      inArray(supplierReturnItems.poItemId, poItemIds),
      ne(supplierReturns.status, 'REJECTED'),
      excludeReturnId ? ne(supplierReturns.id, excludeReturnId) : undefined,
    ))
    .groupBy(supplierReturnItems.poItemId)
  for (const r of rows) if (r.poItemId) map.set(r.poItemId, Number(r.qty))
  return map
}

/** Baris PO beserta sisa qty yang masih bisa diretur — dipakai form (dropdown PO) dan validasi. */
export async function loadReturnablePoItems(executor: Executor, poId: number, excludeReturnId?: number) {
  const items = await executor
    .select({
      id: purchaseOrderItems.id,
      productId: purchaseOrderItems.productId,
      uomId: purchaseOrderItems.uomId,
      qtyReceived: purchaseOrderItems.qtyReceived,
      qtyDamaged: purchaseOrderItems.qtyDamaged,
      unitCost: purchaseOrderItems.unitCost,
      invoiceUnitCost: purchaseOrderItems.invoiceUnitCost,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.poId, poId))
  const returned = await returnedQtyByPoItem(executor, items.map(i => i.id), excludeReturnId)
  return items.map(i => {
    const alreadyReturned = returned.get(i.id) ?? 0
    return {
      ...i,
      alreadyReturned,
      returnableQty: Math.max(0, i.qtyReceived - i.qtyDamaged - alreadyReturned),
      claimPrice: poItemClaimPrice(i),
    }
  })
}

interface PricedItem {
  productId: number
  uomId: number
  poItemId: number | null
  qty: number
  unitPrice: number
  photoUrl: string | null
}

async function priceItems(
  executor: Executor,
  input: SupplierReturnRequest,
  branchId: number,
  excludeReturnId?: number,
): Promise<PricedItem[]> {
  const poId = input.poId ?? null
  if (poId) {
    const [po] = await executor
      .select({
        id: purchaseOrders.id,
        poType: purchaseOrders.poType,
        supplierId: purchaseOrders.supplierId,
        branchId: purchaseOrders.branchId,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poId))
      .limit(1)
    if (!po) throw new SupplierReturnError('PO asal tidak ditemukan', 404)
    if (po.poType !== 'EXTERNAL' || po.supplierId !== input.supplierId)
      throw new SupplierReturnError('PO asal bukan milik supplier yang dipilih')
    if (po.branchId !== branchId) throw new SupplierReturnError('PO asal milik cabang lain')
    if (po.status !== 'COMPLETED')
      throw new SupplierReturnError('PO asal belum selesai diterima — retur hanya untuk barang yang sudah masuk stok')

    const poItems = new Map((await loadReturnablePoItems(executor, poId, excludeReturnId)).map(i => [i.id, i]))
    const usedQty = new Map<number, number>()
    return input.items.map(item => {
      const poItem = item.poItemId ? poItems.get(item.poItemId) : undefined
      if (!poItem || poItem.productId !== item.productId)
        throw new SupplierReturnError('Barang yang diretur harus dipilih dari daftar barang PO asal')
      if (poItem.claimPrice === null)
        throw new SupplierReturnError('Harga faktur PO asal belum diisi — isi harga beli dulu sebelum retur')
      const total = (usedQty.get(poItem.id) ?? 0) + item.qty
      if (total > poItem.returnableQty)
        throw new SupplierReturnError(
          poItem.returnableQty > 0
            ? `Qty retur melebihi sisa yang bisa diretur dari PO ini (maks ${poItem.returnableQty})`
            : 'Barang ini dari PO tersebut sudah habis diretur',
        )
      usedQty.set(poItem.id, total)
      return {
        productId: poItem.productId,
        uomId: poItem.uomId, // satuan mengikuti baris PO — harga per satuan itu
        poItemId: poItem.id,
        qty: item.qty,
        unitPrice: poItem.claimPrice,
        photoUrl: item.photoUrl ?? null,
      }
    })
  }

  // Tanpa PO asal: perkiraan harga = modal terakhir barang itu di cabang ini (per satuan).
  const productIds = [...new Set(input.items.map(i => i.productId))]
  const costs = await executor
    .select({ productId: productUomCosts.productId, uomId: productUomCosts.uomId, costPrice: productUomCosts.costPrice })
    .from(productUomCosts)
    .where(and(eq(productUomCosts.branchId, branchId), inArray(productUomCosts.productId, productIds)))
  const costMap = new Map(costs.map(c => [`${c.productId}:${c.uomId}`, c.costPrice]))
  return input.items.map(item => ({
    productId: item.productId,
    uomId: item.uomId,
    poItemId: null,
    qty: item.qty,
    unitPrice: costMap.get(`${item.productId}:${item.uomId}`) ?? 0,
    photoUrl: item.photoUrl ?? null,
  }))
}

export async function createSupplierReturnRequest(params: {
  input: SupplierReturnRequest
  branchId: number
  userId: number
  source: 'POS' | 'BO'
}) {
  const { input, branchId, userId, source } = params
  const [supplier] = await db
    .select({ id: suppliers.id, isActive: suppliers.isActive })
    .from(suppliers)
    .where(eq(suppliers.id, input.supplierId))
    .limit(1)
  if (!supplier) throw new SupplierReturnError('Supplier tidak ditemukan', 404)
  if (!supplier.isActive)
    throw new SupplierReturnError('Supplier ini sudah nonaktif — barang dari Gudang dikembalikan lewat Retur Internal')

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const priced = await priceItems(tx, input, branchId)
        const totalValue = priced.reduce((acc, it) => acc.plus(new Big(it.unitPrice).times(it.qty)), new Big(0))
        const returnNumber = await generateReturnNumber(tx)
        const [header] = await tx
          .insert(supplierReturns)
          .values({
            returnNumber,
            supplierId: input.supplierId,
            branchId,
            poId: input.poId ?? null,
            reason: input.reason,
            notes: input.notes,
            source,
            status: 'PENDING',
            totalValue: Math.round(totalValue.toNumber()),
            requestedById: userId,
          })
          .returning()
        await tx.insert(supplierReturnItems).values(
          priced.map(it => ({
            supplierReturnId: header.id,
            productId: it.productId,
            uomId: it.uomId,
            poItemId: it.poItemId,
            qty: it.qty,
            unitPrice: it.unitPrice,
            lineValue: Math.round(new Big(it.unitPrice).times(it.qty).toNumber()),
            photoUrl: it.photoUrl,
          })),
        )
        await tx.insert(auditLogs).values({
          branchId,
          userId,
          action: 'SUPPLIER_RETURN_REQUEST',
          tableName: 'supplier_returns',
          recordId: String(header.id),
          newData: JSON.stringify({ returnNumber, supplierId: input.supplierId, poId: input.poId ?? null, totalValue: header.totalValue, source }),
        })
        return header
      })
    } catch (error) {
      // Dua pengajuan di detik yang sama bisa mendapat nomor urut yang sama — coba lagi.
      if (isUniqueViolation(error) && attempt < 2) continue
      throw error
    }
  }
  throw new SupplierReturnError('Gagal membuat nomor retur, coba lagi', 500)
}

/** Kunci baris supplier — penjaga tunggal saldo supplier (retur masuk & pemakaian saldo). */
export async function lockSupplier(tx: Tx, supplierId: number) {
  await tx.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, supplierId)).for('update')
}

export async function supplierCreditBalance(executor: Executor, supplierId: number): Promise<number> {
  const [row] = await executor
    .select({ balance: sql<number>`CAST(COALESCE(SUM(${supplierCreditEntries.amount}), 0) AS INTEGER)` })
    .from(supplierCreditEntries)
    .where(eq(supplierCreditEntries.supplierId, supplierId))
  return Number(row?.balance ?? 0)
}

export async function supplierCreditBalances(executor: Executor): Promise<Map<number, number>> {
  const rows = await executor
    .select({
      supplierId: supplierCreditEntries.supplierId,
      balance: sql<number>`CAST(SUM(${supplierCreditEntries.amount}) AS INTEGER)`,
    })
    .from(supplierCreditEntries)
    .groupBy(supplierCreditEntries.supplierId)
  return new Map(rows.map(r => [r.supplierId, Number(r.balance)]))
}

export async function approveSupplierReturn(params: {
  id: number
  userId: number
  prices?: { itemId: number; unitPrice: number }[]
}) {
  const { id, userId, prices } = params
  return db.transaction(async (tx) => {
    const [header] = await tx.select().from(supplierReturns).where(eq(supplierReturns.id, id)).for('update').limit(1)
    if (!header) throw new SupplierReturnError('Pengajuan retur tidak ditemukan', 404)
    if (header.status !== 'PENDING') throw new SupplierReturnError('Pengajuan ini sudah diproses sebelumnya', 409)

    const items = await tx.select().from(supplierReturnItems).where(eq(supplierReturnItems.supplierReturnId, id))

    // Validasi ulang terhadap PO saat ini (bisa berubah sejak diajukan: faktur dicocokkan,
    // retur lain disetujui lebih dulu). Harga PO diambil ULANG — bukan dari pengajuan.
    let unitPrices = new Map(items.map(it => [it.id, it.unitPrice]))
    if (header.poId) {
      const repriced = await priceItems(tx, {
        supplierId: header.supplierId,
        poId: header.poId,
        reason: header.reason as SupplierReturnReason,
        notes: header.notes,
        items: items.map(it => ({ productId: it.productId, uomId: it.uomId, poItemId: it.poItemId, qty: it.qty })),
      }, header.branchId, id)
      unitPrices = new Map(items.map((it, i) => [it.id, repriced[i].unitPrice]))
    } else if (prices) {
      for (const p of prices) if (unitPrices.has(p.itemId)) unitPrices.set(p.itemId, p.unitPrice)
    }

    await lockProductStocks(tx, header.branchId, items.map(it => it.productId))
    let totalValue = new Big(0)
    let totalCogs = 0
    for (const item of items) {
      // allowNegative=false: barang yang stoknya sudah tidak ada tidak bisa dikirim balik.
      const deduction = await StockService.deductStock(tx, header.branchId, item.productId, item.uomId, item.qty, false)
      const cogs = Math.round(deduction.totalCogs)
      totalCogs += cogs
      const unitPrice = unitPrices.get(item.id) ?? item.unitPrice
      const lineValue = Math.round(new Big(unitPrice).times(item.qty).toNumber())
      totalValue = totalValue.plus(lineValue)
      await tx.update(supplierReturnItems).set({ cogs, unitPrice, lineValue }).where(eq(supplierReturnItems.id, item.id))
    }
    const value = Math.round(totalValue.toNumber())
    if (value <= 0) throw new SupplierReturnError('Nilai retur masih Rp 0 — isi harga barangnya dulu')

    let payable: { id: number; totalAmount: number; paidAmount: number; status: string } | null = null
    if (header.poId) {
      const [row] = await tx
        .select({ id: supplierPayables.id, totalAmount: supplierPayables.totalAmount, paidAmount: supplierPayables.paidAmount, status: supplierPayables.status })
        .from(supplierPayables)
        .where(eq(supplierPayables.poId, header.poId))
        .for('update')
        .limit(1)
      payable = row ?? null
    }
    const { payableDeduction, creditAmount } = splitReturnValue(value, payable)
    const now = new Date()

    let paymentId: number | null = null
    if (payable && payableDeduction > 0) {
      await tx
        .update(supplierPayables)
        .set({
          paidAmount: sql`${supplierPayables.paidAmount} + ${payableDeduction}`,
          status: sql`CASE WHEN ${supplierPayables.paidAmount} + ${payableDeduction} >= ${supplierPayables.totalAmount} THEN 'PAID' ELSE 'PARTIAL' END`,
        })
        .where(eq(supplierPayables.id, payable.id))
      const [payment] = await tx
        .insert(supplierPayablePayments)
        .values({
          payableId: payable.id,
          amount: payableDeduction,
          method: PAYMENT_METHOD_RETUR,
          referenceNumber: header.returnNumber,
          note: `Potong tagihan dari retur ${header.returnNumber}`,
          paidById: userId,
          paidAt: now,
        })
        .returning({ id: supplierPayablePayments.id })
      paymentId = payment.id
    }

    if (creditAmount > 0) {
      await lockSupplier(tx, header.supplierId)
      await tx.insert(supplierCreditEntries).values({
        supplierId: header.supplierId,
        amount: creditAmount,
        sourceType: 'RETUR',
        supplierReturnId: header.id,
        note: header.poId
          ? `Kelebihan retur ${header.returnNumber} (tagihan PO sudah lunas)`
          : `Retur ${header.returnNumber} (tanpa PO asal)`,
        createdById: userId,
        createdAt: now,
      })
    }

    const [updated] = await tx
      .update(supplierReturns)
      .set({
        status: 'APPROVED',
        totalValue: value,
        totalCogs,
        payableDeduction,
        creditAmount,
        payablePaymentId: paymentId,
        resolvedById: userId,
        resolvedAt: now,
      })
      .where(and(eq(supplierReturns.id, id), eq(supplierReturns.status, 'PENDING')))
      .returning()

    await tx.insert(auditLogs).values({
      branchId: header.branchId,
      userId,
      action: 'SUPPLIER_RETURN_APPROVE',
      tableName: 'supplier_returns',
      recordId: String(id),
      newData: JSON.stringify({ returnNumber: header.returnNumber, totalValue: value, totalCogs, payableDeduction, creditAmount, payableId: payable?.id ?? null }),
    })

    return updated
  })
}

export async function rejectSupplierReturn(params: { id: number; userId: number; rejectionReason: string }) {
  const { id, userId, rejectionReason } = params
  return db.transaction(async (tx) => {
    const [header] = await tx.select().from(supplierReturns).where(eq(supplierReturns.id, id)).for('update').limit(1)
    if (!header) throw new SupplierReturnError('Pengajuan retur tidak ditemukan', 404)
    if (header.status !== 'PENDING') throw new SupplierReturnError('Pengajuan ini sudah diproses sebelumnya', 409)

    // Stok & tagihan tidak pernah disentuh selama PENDING — menolak tidak perlu membalik apa pun.
    const [updated] = await tx
      .update(supplierReturns)
      .set({ status: 'REJECTED', resolvedById: userId, resolvedAt: new Date(), rejectionReason })
      .where(and(eq(supplierReturns.id, id), eq(supplierReturns.status, 'PENDING')))
      .returning()

    await tx.insert(auditLogs).values({
      branchId: header.branchId,
      userId,
      action: 'SUPPLIER_RETURN_REJECT',
      tableName: 'supplier_returns',
      recordId: String(id),
      newData: JSON.stringify({ returnNumber: header.returnNumber, rejectionReason }),
    })
    return updated
  })
}

export function supplierReturnErrorResponse(error: unknown): { error: string; status: number } | null {
  if (error instanceof SupplierReturnError) return { error: error.message, status: error.status }
  if (error instanceof InsufficientStockError)
    return { error: `Stok tidak cukup untuk salah satu barang (produk #${error.productId}). Cek stok fisik sebelum menyetujui.`, status: 409 }
  if (error instanceof StockConflictError) return { error: error.message, status: 409 }
  return null
}
