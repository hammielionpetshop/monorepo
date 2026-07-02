import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  productStocks,
  products,
  productUomConversions,
  auditLogs,
  shifts,
  eq,
  and,
  inArray,
} from '@/lib/db'
import { StockService } from './stock-service'

export interface VoidableTransaction {
  id: number
  trxNumber: string
  branchId: number
  shiftId: number | null
  status: string
}

// Error bertipe agar route bisa memetakan ke status code yang tepat.
// Pesan sudah dalam Bahasa Indonesia sehingga bisa dipakai langsung.
export class VoidError extends Error {
  constructor(
    public readonly code:
      | 'TRX_NOT_FOUND'
      | 'TRX_NOT_COMPLETED'
      | 'SHIFT_CLOSED'
      | 'NO_ITEMS'
      | 'CONVERSION_MISSING',
    message: string,
  ) {
    super(message)
    this.name = 'VoidError'
  }
}

/**
 * Ambil transaksi & pastikan layak di-void.
 * - `branchId` (opsional): batasi ke cabang tertentu (jalur kasir). Kosongkan untuk peran global.
 * - `requireShiftOpen`: jalur sync kasir mensyaratkan shift masih OPEN; jalur async bisa dilonggarkan.
 * - `fromStatuses`: status transaksi yang boleh di-void (default `['COMPLETED']`;
 *   jalur approval async memakai `['PENDING_VOID']`).
 */
export async function assertVoidable(
  txId: number,
  opts: { branchId?: number; requireShiftOpen?: boolean; fromStatuses?: string[] } = {},
): Promise<VoidableTransaction> {
  const condition =
    opts.branchId != null
      ? and(eq(transactions.id, txId), eq(transactions.branchId, opts.branchId))
      : eq(transactions.id, txId)

  const [trx] = await db
    .select({
      id: transactions.id,
      trxNumber: transactions.trxNumber,
      branchId: transactions.branchId,
      shiftId: transactions.shiftId,
      status: transactions.status,
    })
    .from(transactions)
    .where(condition)
    .limit(1)

  if (!trx) {
    throw new VoidError('TRX_NOT_FOUND', 'Transaksi tidak ditemukan')
  }
  const fromStatuses = opts.fromStatuses ?? ['COMPLETED']
  if (!fromStatuses.includes(trx.status)) {
    throw new VoidError('TRX_NOT_COMPLETED', 'Transaksi sudah dibatalkan atau tidak dapat di-void')
  }

  if (opts.requireShiftOpen) {
    if (trx.shiftId == null) {
      throw new VoidError('SHIFT_CLOSED', 'Shift sudah ditutup, void tidak diizinkan')
    }
    const [shift] = await db
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, trx.shiftId))
      .limit(1)
    if (!shift || shift.status !== 'OPEN') {
      throw new VoidError('SHIFT_CLOSED', 'Shift sudah ditutup, void tidak diizinkan')
    }
  }

  return trx
}

/**
 * Inti void — dijalankan di dalam sebuah transaksi DB (`tx`) sehingga bisa dikomposisi
 * dengan mutasi lain (mis. update `void_requests` pada jalur approval async).
 * Melakukan: kunci stok, set status VOIDED, kembalikan stok FIFO, tulis audit log.
 * Guard status ganda (re-check dalam tx) mencegah double-void akibat race.
 */
export async function performVoidWithinTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    txId: number
    branchId: number
    trxNumber: string
    actorUserId: number
    auditAction?: string
    auditNewData?: Record<string, unknown>
    fromStatuses?: string[]
  },
): Promise<void> {
  const { txId, branchId, trxNumber, actorUserId } = params
  const fromStatuses = params.fromStatuses ?? ['COMPLETED']

  // Re-check status di dalam transaksi (idempotency terhadap double-void)
  const [current] = await tx
    .select({ status: transactions.status })
    .from(transactions)
    .where(eq(transactions.id, txId))
    .limit(1)
  if (!current || !fromStatuses.includes(current.status)) {
    throw new VoidError('TRX_NOT_COMPLETED', 'Transaksi sudah dibatalkan atau tidak dapat di-void')
  }

  const items = await tx
    .select({
      productId: transactionItems.productId,
      uomId: transactionItems.uomId,
      qty: transactionItems.qty,
      cogs: transactionItems.cogs,
    })
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, txId))

  const productIds = [
    ...new Set(items.map((i) => i.productId).filter((id): id is number => id !== null)),
  ]
  if (productIds.length === 0) {
    throw new VoidError('NO_ITEMS', 'Transaksi tidak memiliki item produk untuk dibatalkan')
  }

  const productRows = await tx
    .select({ id: products.id, baseUomId: products.baseUomId })
    .from(products)
    .where(inArray(products.id, productIds))
  const productBaseUomMap = new Map(productRows.map((p) => [p.id, p.baseUomId]))

  const conversionRows = await tx
    .select({
      productId: productUomConversions.productId,
      uomId: productUomConversions.uomId,
      ratio: productUomConversions.ratio,
    })
    .from(productUomConversions)
    .where(inArray(productUomConversions.productId, productIds))
  const conversionMap = new Map(
    conversionRows.map((c) => [`${c.productId}:${c.uomId}`, c.ratio]),
  )

  // Pessimistic lock pada product stocks (anti race condition)
  await tx
    .select({ id: productStocks.id })
    .from(productStocks)
    .where(and(inArray(productStocks.productId, productIds), eq(productStocks.branchId, branchId)))
    .for('update')

  // 1. Update status transaksi menjadi VOIDED
  await tx
    .update(transactions)
    .set({ status: 'VOIDED', updatedAt: new Date() })
    .where(eq(transactions.id, txId))

  // 2. Kembalikan stok tiap item (FIFO reversal — masukkan batch baru)
  for (const item of items) {
    if (item.productId === null) continue // produk sudah dihapus → stok tidak bisa dikembalikan
    const baseUomId = productBaseUomMap.get(item.productId)
    if (!baseUomId) continue

    let ratioToBase = 1
    if (item.uomId !== baseUomId) {
      const ratio = conversionMap.get(`${item.productId}:${item.uomId}`)
      if (!ratio) {
        throw new VoidError(
          'CONVERSION_MISSING',
          `Rasio konversi untuk produk ID ${item.productId} ke UOM basis tidak ditemukan`,
        )
      }
      ratioToBase = Number(ratio)
    }

    const baseQtyToReturn = item.qty * ratioToBase

    // Harga modal per unit base UOM dengan presisi big.js
    const costPricePerUnit =
      baseQtyToReturn > 0 ? new Big(item.cogs ?? 0).div(baseQtyToReturn).toString() : '0'

    await StockService.addStock(
      tx,
      branchId,
      item.productId,
      baseUomId,
      String(baseQtyToReturn),
      costPricePerUnit,
    )
  }

  // 3. Audit log
  await tx.insert(auditLogs).values({
    branchId,
    userId: actorUserId,
    action: params.auditAction ?? 'VOID_TRANSACTION',
    tableName: 'transactions',
    recordId: String(txId),
    newData: JSON.stringify({
      trxNumber,
      voidedBy: actorUserId,
      ...(params.auditNewData ?? {}),
    }),
  })
}

/**
 * Bungkus `performVoidWithinTx` dalam satu transaksi DB tersendiri.
 * Dipakai jalur sync kasir yang tak perlu mengomposisi mutasi lain.
 */
export async function performVoid(params: {
  txId: number
  branchId: number
  trxNumber: string
  actorUserId: number
  auditAction?: string
  auditNewData?: Record<string, unknown>
}): Promise<void> {
  await db.transaction((tx) => performVoidWithinTx(tx, params))
}
