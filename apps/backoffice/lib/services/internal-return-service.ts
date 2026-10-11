import Big from 'big.js'
import { z } from 'zod'
import {
  db,
  internalReturns,
  internalReturnItems,
  internalCreditEntries,
  interBranchTransfers,
  interBranchTransferItems,
  interBranchPayables,
  interBranchPayments,
  transactions,
  returns,
  products,
  unitsOfMeasure,
  branches,
  auditLogs,
  eq,
  and,
  ne,
  or,
  inArray,
  like,
  desc,
  sql,
} from '@/lib/db'
import { poDateStr, isUniqueViolation } from '@/lib/po-number'
import { lockStockPairs } from '@/lib/services/stock-lock'
import { StockService, InsufficientStockError } from '@/lib/services/stock-service'
import { StockConflictError } from '@/lib/services/stock-validation'
import { ReturService } from '@/lib/services/retur-service'
import { allocateIbtShortage, loadSaleLinesForRetur, loadUomRatios } from '@/lib/services/ibt-bulk-sale-match'
import {
  applyInternalCredit,
  internalCreditBalance,
  internalCreditRemainingOfReturn,
  lockInternalCreditPair,
} from '@/lib/services/internal-credit-service'

export { internalCreditBalance, lockInternalCreditPair }

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

/**
 * Retur Internal — "Barang Dikembalikan" (RI5, docs/work/specs/2026-10-11-retur-internal-design.md
 * bagian A). Barang kiriman antar cabang (PO Internal → Bulk Sale pengirim → IBT) yang tercatat
 * diterima tapi tidak datang / salah kirim dikembalikan ke cabang PENGIRIM (Gudang atau toko).
 * Hanya stok bagus — barang rusak tetap lewat Barang Rusak.
 *
 * PENDING tidak menyentuh stok/uang. Disetujui (Owner/GM) dalam satu transaksi DB: stok penerima
 * keluar FIFO, nota Bulk Sale pengirim diretur (stok pengirim masuk lagi dengan modal nota, omzet
 * & HPP pengirim turun), hutang internal IBT itu dipotong (baris pembayaran RETUR_INTERNAL), sisanya
 * jadi Saldo Internal pasangan penerima → pengirim, yang langsung memotong tagihan internal terbuka
 * tertua pasangan itu (RI7, `internal-credit-service.ts`).
 */

export const INTERNAL_RETURN_KIND_GOODS = 'BARANG_DIKEMBALIKAN'

export const RETURNED_GOODS_REASONS = ['TIDAK_DATANG', 'SALAH_KIRIM', 'LAINNYA'] as const
export type ReturnedGoodsReason = (typeof RETURNED_GOODS_REASONS)[number]

export const RETURNED_GOODS_REASON_LABELS: Record<ReturnedGoodsReason, string> = {
  TIDAK_DATANG: 'Barang tidak datang / kurang kirim',
  SALAH_KIRIM: 'Salah kirim (barang tercatat tapi tidak ada)',
  LAINNYA: 'Lainnya',
}

/** Status IBT yang barangnya sudah masuk stok penerima — hanya ini yang bisa diretur. */
const RECEIVED_TRANSFER_STATUSES = ['FULLY_RECEIVED', 'PARTIALLY_RECEIVED']
/** Status yang masih "memakai" qty kiriman — ditolak, ditarik, dan dibatalkan membebaskannya lagi. */
const ACTIVE_RETURN_STATUSES = ['PENDING', 'APPROVED']

export class InternalReturnError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'InternalReturnError'
  }
}

export const returnedGoodsRequestSchema = z.object({
  transferId: z.number().int().positive('Cari kode transaksi asal dulu'),
  reason: z.enum(RETURNED_GOODS_REASONS, { message: 'Alasan tidak valid' }),
  notes: z.string().trim().min(5, 'Jelaskan alasan retur (minimal 5 huruf)').max(500, 'Penjelasan maksimal 500 karakter'),
  items: z
    .array(
      z.object({
        transferItemId: z.number().int().positive(),
        qty: z.number().int().positive('Qty harus lebih dari 0'),
        photoUrl: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1, 'Minimal satu barang yang dikembalikan')
    .max(100, 'Maksimal 100 barang per retur'),
})
export type ReturnedGoodsRequest = z.infer<typeof returnedGoodsRequestSchema>

export interface InternalReturnActor {
  userId: number
  branchId: number
  /** OWNER/GM (`branchScope === 'ALL'`) boleh mengurus kiriman cabang mana pun. */
  allBranches: boolean
}

function assertActorBranch(actor: InternalReturnActor, transfer: { sourceBranchId: number; destinationBranchId: number }) {
  if (actor.allBranches) return
  if (actor.branchId !== transfer.sourceBranchId && actor.branchId !== transfer.destinationBranchId)
    throw new InternalReturnError('Kiriman ini bukan dari / ke cabang Anda', 403)
}

async function generateReturnNumber(executor: Executor, now = new Date()): Promise<string> {
  const dateStr = poDateStr(now)
  const [last] = await executor
    .select({ returnNumber: internalReturns.returnNumber })
    .from(internalReturns)
    .where(like(internalReturns.returnNumber, `RI-${dateStr}-%`))
    .orderBy(desc(internalReturns.returnNumber))
    .limit(1)
  const lastSeq = Number.parseInt(last?.returnNumber.split('-')[2] ?? '', 10)
  const next = Number.isInteger(lastSeq) && lastSeq > 0 ? lastSeq + 1 : 1
  return `RI-${dateStr}-${next.toString().padStart(4, '0')}`
}

/**
 * Qty per baris IBT yang sudah/sedang dikembalikan (PENDING + APPROVED) supaya satu kiriman tidak
 * bisa diretur melebihi yang diterima. `excludeReturnId` = dokumen yang sedang diproses.
 */
async function returnedQtyByTransferItem(executor: Executor, transferItemIds: number[], excludeReturnId?: number) {
  const map = new Map<number, number>()
  if (transferItemIds.length === 0) return map
  const rows = await executor
    .select({
      transferItemId: internalReturnItems.transferItemId,
      qty: sql<number>`CAST(SUM(${internalReturnItems.qty}) AS INTEGER)`,
    })
    .from(internalReturnItems)
    .innerJoin(internalReturns, eq(internalReturnItems.internalReturnId, internalReturns.id))
    .where(and(
      inArray(internalReturnItems.transferItemId, transferItemIds),
      eq(internalReturns.kind, INTERNAL_RETURN_KIND_GOODS),
      inArray(internalReturns.status, ACTIVE_RETURN_STATUSES),
      excludeReturnId ? ne(internalReturns.id, excludeReturnId) : undefined,
    ))
    .groupBy(internalReturnItems.transferItemId)
  for (const r of rows) map.set(r.transferItemId, Number(r.qty))
  return map
}

/** Baris IBT beserta sisa qty yang masih bisa dikembalikan — dipakai form (RI6) dan validasi. */
export async function loadReturnableTransferItems(executor: Executor, transferId: number, excludeReturnId?: number) {
  const items = await executor
    .select({
      id: interBranchTransferItems.id,
      productId: interBranchTransferItems.productId,
      productName: products.name,
      uomId: interBranchTransferItems.uomId,
      uomCode: unitsOfMeasure.code,
      qtyReceived: interBranchTransferItems.qtyReceived,
      unitPrice: interBranchTransferItems.costPriceAtTransfer,
    })
    .from(interBranchTransferItems)
    .innerJoin(products, eq(products.id, interBranchTransferItems.productId))
    .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, interBranchTransferItems.uomId))
    .where(eq(interBranchTransferItems.transferId, transferId))
    .orderBy(interBranchTransferItems.id)
  const returned = await returnedQtyByTransferItem(executor, items.map(i => i.id), excludeReturnId)
  return items.map(i => {
    const alreadyReturned = returned.get(i.id) ?? 0
    return { ...i, alreadyReturned, returnableQty: Math.max(0, i.qtyReceived - alreadyReturned) }
  })
}

type TransferRow = typeof interBranchTransfers.$inferSelect

/** Syarat kiriman yang boleh diretur: hasil Bulk Sale, sudah diterima, notanya masih berlaku. */
async function assertReturnableTransfer(executor: Executor, transfer: TransferRow) {
  if (transfer.convertedTransactionId == null)
    throw new InternalReturnError('Kiriman ini bukan hasil Bulk Sale (transfer lama) — tidak bisa lewat Retur Internal')
  if (!RECEIVED_TRANSFER_STATUSES.includes(transfer.status))
    throw new InternalReturnError('Kiriman ini belum diterima — selisih saat menerima dicatat di layar terima transfer')
  const [sale] = await executor
    .select({ id: transactions.id, trxNumber: transactions.trxNumber, status: transactions.status })
    .from(transactions)
    .where(eq(transactions.id, transfer.convertedTransactionId))
    .limit(1)
  if (!sale) throw new InternalReturnError('Nota Bulk Sale kiriman ini tidak ditemukan', 404)
  if (sale.status !== 'COMPLETED')
    throw new InternalReturnError('Nota Bulk Sale kiriman ini sudah dibatalkan / sedang diajukan void')
  const [payable] = await executor
    .select()
    .from(interBranchPayables)
    .where(eq(interBranchPayables.transferId, transfer.id))
    .limit(1)
  if (payable?.status === 'WAIVED')
    throw new InternalReturnError('Hutang internal kiriman ini sudah diputihkan — hubungi Owner')
  return { sale, payable: payable ?? null }
}

/**
 * Cari kiriman dari kode transaksi (wajib, keputusan owner #5): nomor IBT atau nomor nota Bulk Sale.
 * Mengembalikan data untuk form: kiriman, nota, hutang, dan barang beserta sisa yang bisa diretur.
 */
export async function findReturnableTransfer(code: string, actor: InternalReturnActor) {
  const key = code.trim().toUpperCase()
  if (!key) throw new InternalReturnError('Masukkan nomor transfer (IBT) atau nomor nota Bulk Sale')
  const [transfer] = await db
    .select({ transfer: interBranchTransfers })
    .from(interBranchTransfers)
    .leftJoin(transactions, eq(transactions.id, interBranchTransfers.convertedTransactionId))
    .where(or(sql`UPPER(${interBranchTransfers.ibtNumber}) = ${key}`, sql`UPPER(${transactions.trxNumber}) = ${key}`))
    .limit(1)
  if (!transfer) throw new InternalReturnError('Kode transaksi tidak ditemukan. Periksa nomor IBT / nota Bulk Sale.', 404)
  const t = transfer.transfer
  assertActorBranch(actor, t)
  const { sale, payable } = await assertReturnableTransfer(db, t)
  const branchRows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(inArray(branches.id, [t.sourceBranchId, t.destinationBranchId]))
  const branchName = (id: number) => branchRows.find(b => b.id === id)?.name ?? `Cabang #${id}`
  return {
    transfer: {
      id: t.id,
      ibtNumber: t.ibtNumber,
      status: t.status,
      receivedAt: t.receivedAt,
      senderBranchId: t.sourceBranchId,
      senderBranchName: branchName(t.sourceBranchId),
      receiverBranchId: t.destinationBranchId,
      receiverBranchName: branchName(t.destinationBranchId),
    },
    sale: { id: sale.id, trxNumber: sale.trxNumber },
    payable: payable && { id: payable.id, totalAmount: payable.totalAmount, paidAmount: payable.paidAmount, status: payable.status },
    items: await loadReturnableTransferItems(db, t.id),
  }
}

/**
 * Qty retur per baris nota Bulk Sale. Satuan baris IBT bisa beda dari satuan nota, jadi
 * dialokasikan lewat satuan dasar (pola selisih terima IBT, kanban #56). `null` = tidak bisa
 * dinyatakan utuh dalam satuan nota (mis. kembali 1 PCS padahal nota per SAK).
 */
async function allocateToSaleLines(
  executor: Executor,
  saleTransactionId: number,
  lines: { productId: number; uomId: number; qty: number }[],
) {
  const saleLines = await loadSaleLinesForRetur(executor, saleTransactionId)
  const productIds = [...new Set([...lines.map(l => l.productId), ...saleLines.map(l => l.productId)])]
  const { ratioMap } = await loadUomRatios(executor, productIds)
  const allocation = allocateIbtShortage(lines, saleLines, ratioMap)
  if (!allocation) return null
  const productByLine = new Map(saleLines.map(l => [l.id, l.productId]))
  return allocation.map(a => ({ ...a, productId: productByLine.get(a.transactionItemId)! }))
}

const NOT_ALLOCATABLE =
  'Qty yang dikembalikan tidak bisa dicocokkan dengan satuan di nota Bulk Sale (mis. nota per SAK, kembali per PCS). Sesuaikan qty ke kelipatan satuan nota.'

export async function createReturnedGoodsRequest(params: {
  input: ReturnedGoodsRequest
  actor: InternalReturnActor
  source: 'POS' | 'BO'
}) {
  const { input, actor, source } = params
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // Kunci kiriman: pengajuan & persetujuan untuk IBT yang sama antre, jadi sisa qty tidak terhitung dobel.
        const [transfer] = await tx
          .select()
          .from(interBranchTransfers)
          .where(eq(interBranchTransfers.id, input.transferId))
          .for('update')
          .limit(1)
        if (!transfer) throw new InternalReturnError('Kiriman tidak ditemukan', 404)
        assertActorBranch(actor, transfer)
        const { sale, payable } = await assertReturnableTransfer(tx, transfer)

        const available = new Map((await loadReturnableTransferItems(tx, transfer.id)).map(i => [i.id, i]))
        const usedQty = new Map<number, number>()
        const priced = input.items.map(item => {
          const row = available.get(item.transferItemId)
          if (!row) throw new InternalReturnError('Barang yang dikembalikan harus dipilih dari daftar barang kiriman ini')
          const total = (usedQty.get(row.id) ?? 0) + item.qty
          if (total > row.returnableQty)
            throw new InternalReturnError(
              row.returnableQty > 0
                ? `Qty ${row.productName} melebihi sisa yang bisa dikembalikan (maks ${row.returnableQty} ${row.uomCode})`
                : `${row.productName} dari kiriman ini sudah habis dikembalikan`,
            )
          usedQty.set(row.id, total)
          return { row, qty: item.qty, photoUrl: item.photoUrl ?? null }
        })
        const allocation = await allocateToSaleLines(
          tx,
          sale.id,
          priced.map(p => ({ productId: p.row.productId, uomId: p.row.uomId, qty: p.qty })),
        )
        if (!allocation) throw new InternalReturnError(NOT_ALLOCATABLE)

        const totalValue = priced.reduce((acc, p) => acc.plus(new Big(p.row.unitPrice).times(p.qty)), new Big(0))
        const returnNumber = await generateReturnNumber(tx)
        const [header] = await tx
          .insert(internalReturns)
          .values({
            returnNumber,
            kind: INTERNAL_RETURN_KIND_GOODS,
            transferId: transfer.id,
            saleTransactionId: sale.id,
            payableId: payable?.id ?? null,
            requestBranchId: actor.branchId,
            receiverBranchId: transfer.destinationBranchId,
            senderBranchId: transfer.sourceBranchId,
            reason: input.reason,
            notes: input.notes,
            source,
            status: 'PENDING',
            totalValue: Math.round(totalValue.toNumber()),
            requestedById: actor.userId,
          })
          .returning()
        await tx.insert(internalReturnItems).values(
          priced.map(p => ({
            internalReturnId: header.id,
            transferItemId: p.row.id,
            productId: p.row.productId,
            uomId: p.row.uomId,
            qty: p.qty,
            oldUnitPrice: p.row.unitPrice,
            lineValue: Math.round(new Big(p.row.unitPrice).times(p.qty).toNumber()),
            photoUrl: p.photoUrl,
          })),
        )
        await tx.insert(auditLogs).values({
          branchId: actor.branchId,
          userId: actor.userId,
          action: 'INTERNAL_RETURN_REQUEST',
          tableName: 'internal_returns',
          recordId: String(header.id),
          newData: JSON.stringify({
            returnNumber,
            kind: INTERNAL_RETURN_KIND_GOODS,
            ibtNumber: transfer.ibtNumber,
            trxNumber: sale.trxNumber,
            totalValue: header.totalValue,
            source,
          }),
        })
        return header
      })
    } catch (error) {
      // Dua pengajuan di detik yang sama bisa mendapat nomor urut yang sama — coba lagi.
      if (isUniqueViolation(error) && attempt < 2) continue
      throw error
    }
  }
  throw new InternalReturnError('Gagal membuat nomor retur internal, coba lagi', 500)
}

/** Pembagian nilai retur: potong sisa hutang internal IBT itu dulu, kelebihannya jadi Saldo Internal. */
export function splitInternalReturnValue(
  totalValue: number,
  payable: { totalAmount: number; paidAmount: number } | null,
): { payableDeduction: number; creditAmount: number } {
  const remaining = payable ? Math.max(0, payable.totalAmount - payable.paidAmount) : 0
  const payableDeduction = Math.min(totalValue, remaining)
  return { payableDeduction, creditAmount: totalValue - payableDeduction }
}

async function lockGoodsReturn(tx: Tx, id: number, expectedStatus: string, notFound: string) {
  const [header] = await tx.select().from(internalReturns).where(eq(internalReturns.id, id)).for('update').limit(1)
  if (!header) throw new InternalReturnError(notFound, 404)
  if (header.kind !== INTERNAL_RETURN_KIND_GOODS) throw new InternalReturnError('Dokumen ini bukan Barang Dikembalikan')
  if (header.status !== expectedStatus)
    throw new InternalReturnError(
      expectedStatus === 'PENDING' ? 'Pengajuan ini sudah diproses sebelumnya' : 'Hanya retur berstatus Disetujui yang bisa dibatalkan',
      409,
    )
  // Urutan kunci sama dengan penerimaan IBT: kiriman → stok → saldo pasangan cabang → hutang — tidak deadlock.
  const [transfer] = await tx.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, header.transferId)).for('update').limit(1)
  if (!transfer) throw new InternalReturnError('Kiriman asal tidak ditemukan', 404)
  const items = await tx.select().from(internalReturnItems).where(eq(internalReturnItems.internalReturnId, id)).orderBy(internalReturnItems.id)
  return { header, transfer, items }
}

export async function approveReturnedGoods(params: { id: number; userId: number }) {
  const { id, userId } = params
  return db.transaction(async (tx) => {
    const { header, transfer, items } = await lockGoodsReturn(tx, id, 'PENDING', 'Pengajuan retur internal tidak ditemukan')
    const { sale } = await assertReturnableTransfer(tx, transfer)

    // Validasi ulang sisa qty & harga dari kiriman SAAT INI (dokumen lain bisa disetujui lebih dulu).
    const available = new Map((await loadReturnableTransferItems(tx, transfer.id, id)).map(i => [i.id, i]))
    const usedQty = new Map<number, number>()
    for (const item of items) {
      const row = available.get(item.transferItemId)
      const total = (usedQty.get(item.transferItemId) ?? 0) + item.qty
      if (!row || total > row.returnableQty)
        throw new InternalReturnError(`Qty ${row?.productName ?? `produk #${item.productId}`} melebihi sisa kiriman yang bisa dikembalikan`, 409)
      usedQty.set(item.transferItemId, total)
    }

    await lockStockPairs(tx, items.flatMap(it => [
      { branchId: header.receiverBranchId, productId: it.productId },
      { branchId: header.senderBranchId, productId: it.productId },
    ]))

    // 1. Stok penerima keluar FIFO. allowNegative=false: barang yang dikembalikan harus benar-benar ada.
    let totalValue = new Big(0)
    for (const item of items) {
      const unitPrice = available.get(item.transferItemId)!.unitPrice
      let cogs: number
      try {
        const deduction = await StockService.deductStock(tx, header.receiverBranchId, item.productId, item.uomId, item.qty, false)
        cogs = Math.round(deduction.totalCogs)
      } catch (error) {
        if (error instanceof InsufficientStockError)
          throw new InternalReturnError(
            `Stok ${available.get(item.transferItemId)!.productName} di cabang penerima tidak cukup — yang dikembalikan harus stok bagus yang masih ada`,
            409,
          )
        throw error
      }
      const lineValue = Math.round(new Big(unitPrice).times(item.qty).toNumber())
      totalValue = totalValue.plus(lineValue)
      await tx.update(internalReturnItems).set({ cogs, oldUnitPrice: unitPrice, lineValue }).where(eq(internalReturnItems.id, item.id))
    }
    const value = Math.round(totalValue.toNumber())

    // 2. Nota Bulk Sale pengirim diretur: stok pengirim masuk lagi dengan modal nota, omzet & HPP turun.
    const allocation = await allocateToSaleLines(tx, sale.id, items.map(it => ({ productId: it.productId, uomId: it.uomId, qty: it.qty })))
    if (!allocation || allocation.length === 0) throw new InternalReturnError(NOT_ALLOCATABLE, 409)
    // Baris nota yang cocok dicatat bila satu-satunya untuk produk itu (bisa terbagi ke beberapa satuan).
    for (const item of items) {
      const lines = allocation.filter(a => a.productId === item.productId)
      if (lines.length === 1)
        await tx.update(internalReturnItems).set({ saleItemId: lines[0].transactionItemId }).where(eq(internalReturnItems.id, item.id))
    }
    const saleReturn = await ReturService.applyReturInTx(tx, {
      transactionId: sale.id,
      branchId: header.senderBranchId,
      processedById: userId,
      reason: `Retur Internal ${header.returnNumber} (${transfer.ibtNumber}) — ${header.notes}`,
      items: allocation.map(a => ({ transactionItemId: a.transactionItemId, qty: String(a.qty) })),
    })
    const [saleReturnRow] = await tx.select({ id: returns.id }).from(returns).where(eq(returns.returnNumber, saleReturn.returnNumber)).limit(1)

    // 3. Hutang internal IBT itu dipotong lebih dulu, kelebihannya jadi Saldo Internal.
    await lockInternalCreditPair(tx, header.receiverBranchId, header.senderBranchId)
    const [payable] = await tx
      .select()
      .from(interBranchPayables)
      .where(eq(interBranchPayables.transferId, transfer.id))
      .for('update')
      .limit(1)
    if (!payable && value > 0) throw new InternalReturnError('Hutang internal kiriman ini tidak ditemukan', 409)
    const { payableDeduction, creditAmount } = splitInternalReturnValue(value, payable ?? null)
    const now = new Date()

    let paymentId: number | null = null
    if (payable && payableDeduction > 0) {
      await tx
        .update(interBranchPayables)
        .set({
          paidAmount: sql`${interBranchPayables.paidAmount} + ${payableDeduction}`,
          status: sql`CASE WHEN ${interBranchPayables.paidAmount} + ${payableDeduction} >= ${interBranchPayables.totalAmount} THEN 'PAID' ELSE 'PARTIAL' END`,
          updatedAt: now,
        })
        .where(eq(interBranchPayables.id, payable.id))
      // Bukan uang kas: tanpa metode bayar & tanpa catatan Pendapatan/Pengeluaran.
      const [payment] = await tx
        .insert(interBranchPayments)
        .values({
          payableId: payable.id,
          amount: payableDeduction,
          paidByUserId: userId,
          sourceType: 'RETUR_INTERNAL',
          referenceNumber: header.returnNumber,
          notes: `Potong hutang dari Retur Internal ${header.returnNumber} atas kiriman ${transfer.ibtNumber} / nota ${sale.trxNumber}`,
          paidAt: now,
        })
        .returning({ id: interBranchPayments.id })
      paymentId = payment.id
    }

    if (creditAmount > 0) {
      await tx.insert(internalCreditEntries).values({
        debtorBranchId: header.receiverBranchId,
        creditorBranchId: header.senderBranchId,
        amount: creditAmount,
        sourceType: 'RETUR_INTERNAL',
        internalReturnId: header.id,
        payableId: payable?.id ?? null,
        note: `Kelebihan Retur Internal ${header.returnNumber} (hutang ${transfer.ibtNumber} / nota ${sale.trxNumber} sudah lunas)`,
        createdById: userId,
        createdAt: now,
      })
    }
    // 4. Saldo tidak mengendap: langsung memotong tagihan internal terbuka tertua pasangan cabang ini (RI7).
    const creditUsages = await applyInternalCredit(tx, {
      debtorBranchId: header.receiverBranchId,
      creditorBranchId: header.senderBranchId,
      userId,
      now,
    })

    const [updated] = await tx
      .update(internalReturns)
      .set({
        status: 'APPROVED',
        totalValue: value,
        payableId: payable?.id ?? null,
        payableDeduction,
        creditAmount,
        payablePaymentId: paymentId,
        saleReturnId: saleReturnRow?.id ?? null,
        resolvedById: userId,
        resolvedAt: now,
      })
      .where(and(eq(internalReturns.id, id), eq(internalReturns.status, 'PENDING')))
      .returning()

    await tx.insert(auditLogs).values({
      branchId: header.receiverBranchId,
      userId,
      action: 'INTERNAL_RETURN_APPROVE',
      tableName: 'internal_returns',
      recordId: String(id),
      newData: JSON.stringify({
        returnNumber: header.returnNumber,
        ibtNumber: transfer.ibtNumber,
        totalValue: value,
        payableDeduction,
        creditAmount,
        payableId: payable?.id ?? null,
        saleReturnNumber: saleReturn.returnNumber,
        creditUsed: creditUsages.reduce((sum, u) => sum + u.amount, 0),
      }),
    })
    return updated
  })
}

/** Tolak (Owner/GM) — berlaku untuk semua jenis Retur Internal. Tidak ada yang berubah selama PENDING. */
export async function rejectInternalReturn(params: { id: number; userId: number; rejectionReason: string }) {
  const { id, userId, rejectionReason } = params
  return db.transaction(async (tx) => {
    const [header] = await tx.select().from(internalReturns).where(eq(internalReturns.id, id)).for('update').limit(1)
    if (!header) throw new InternalReturnError('Pengajuan retur internal tidak ditemukan', 404)
    if (header.status !== 'PENDING') throw new InternalReturnError('Pengajuan ini sudah diproses sebelumnya', 409)
    const [updated] = await tx
      .update(internalReturns)
      .set({ status: 'REJECTED', resolvedById: userId, resolvedAt: new Date(), rejectionReason })
      .where(and(eq(internalReturns.id, id), eq(internalReturns.status, 'PENDING')))
      .returning()
    await tx.insert(auditLogs).values({
      branchId: header.requestBranchId,
      userId,
      action: 'INTERNAL_RETURN_REJECT',
      tableName: 'internal_returns',
      recordId: String(id),
      newData: JSON.stringify({ returnNumber: header.returnNumber, rejectionReason }),
    })
    return updated
  })
}

/** Pengaju menarik pengajuannya sendiri yang masih menunggu — tidak ada efek stok/uang. */
export async function withdrawInternalReturn(params: { id: number; userId: number }) {
  const { id, userId } = params
  return db.transaction(async (tx) => {
    const [header] = await tx.select().from(internalReturns).where(eq(internalReturns.id, id)).for('update').limit(1)
    if (!header) throw new InternalReturnError('Pengajuan retur internal tidak ditemukan', 404)
    if (header.requestedById !== userId) throw new InternalReturnError('Hanya pengaju yang boleh menarik pengajuan ini', 403)
    if (header.status !== 'PENDING') throw new InternalReturnError('Pengajuan ini sudah diproses — tidak bisa ditarik lagi', 409)
    const [updated] = await tx
      .update(internalReturns)
      .set({ status: 'WITHDRAWN', resolvedById: userId, resolvedAt: new Date() })
      .where(and(eq(internalReturns.id, id), eq(internalReturns.status, 'PENDING')))
      .returning()
    await tx.insert(auditLogs).values({
      branchId: header.requestBranchId,
      userId,
      action: 'INTERNAL_RETURN_WITHDRAW',
      tableName: 'internal_returns',
      recordId: String(id),
      newData: JSON.stringify({ returnNumber: header.returnNumber }),
    })
    return updated
  })
}

/**
 * Batalkan Barang Dikembalikan yang sudah DISETUJUI (Owner/GM, alasan wajib). Semua efek dibalik
 * dalam satu transaksi sebagai catatan baru: retur nota Bulk Sale dibatalkan (stok pengirim keluar
 * lagi, omzet pengirim kembali), stok penerima masuk lagi dengan modal = HPP saat keluar, potongan
 * hutang dibalik lewat baris pembayaran negatif BATAL_RETUR, Saldo Internal dari dokumen ini
 * dikurangi. Ditolak bila stok pengirim sudah tidak cukup atau saldo dari dokumen ini sudah terpakai
 * memotong tagihan lain (RI7). Hutang yang terbuka lagi ikut dipotong saldo lain yang masih ada.
 */
export async function cancelReturnedGoods(params: { id: number; userId: number; reason: string }) {
  const { id, userId, reason } = params
  return db.transaction(async (tx) => {
    const { header, items } = await lockGoodsReturn(tx, id, 'APPROVED', 'Retur internal tidak ditemukan')
    const now = new Date()

    await lockStockPairs(tx, items.flatMap(it => [
      { branchId: header.receiverBranchId, productId: it.productId },
      { branchId: header.senderBranchId, productId: it.productId },
    ]))

    if (header.saleReturnId) {
      try {
        await ReturService.cancelReturnInTx(tx, {
          returnId: header.saleReturnId,
          branchId: header.senderBranchId,
          cancelledById: userId,
          cancelReason: `Pembatalan Retur Internal ${header.returnNumber}: ${reason}`,
        })
      } catch (error) {
        if (error instanceof InsufficientStockError)
          throw new InternalReturnError(
            'Stok di cabang pengirim sudah tidak cukup untuk dikirim balik — pembatalan ditolak, perbaiki dengan dokumen baru',
            409,
          )
        throw error
      }
    }

    for (const item of items) {
      const costPerUnit = item.qty > 0 ? new Big(item.cogs ?? 0).div(item.qty).toString() : '0'
      await StockService.addStock(tx, header.receiverBranchId, item.productId, item.uomId, String(item.qty), costPerUnit, now)
    }

    await lockInternalCreditPair(tx, header.receiverBranchId, header.senderBranchId)
    let reversalPaymentId: number | null = null
    if (header.payableDeduction > 0) {
      const [payable] = header.payableId
        ? await tx.select().from(interBranchPayables).where(eq(interBranchPayables.id, header.payableId)).for('update').limit(1)
        : []
      if (!payable || payable.status === 'WAIVED' || payable.paidAmount < header.payableDeduction)
        throw new InternalReturnError('Hutang internal kiriman ini sudah berubah sehingga potongannya tidak bisa dibalik — perbaiki dengan dokumen baru', 409)
      await tx
        .update(interBranchPayables)
        .set({
          paidAmount: sql`${interBranchPayables.paidAmount} - ${header.payableDeduction}`,
          status: sql`CASE WHEN ${interBranchPayables.paidAmount} - ${header.payableDeduction} >= ${interBranchPayables.totalAmount} THEN 'PAID'
            WHEN ${interBranchPayables.paidAmount} - ${header.payableDeduction} > 0 THEN 'PARTIAL' ELSE 'UNPAID' END`,
          updatedAt: now,
        })
        .where(eq(interBranchPayables.id, payable.id))
      const [payment] = await tx
        .insert(interBranchPayments)
        .values({
          payableId: payable.id,
          amount: -header.payableDeduction,
          paidByUserId: userId,
          sourceType: 'BATAL_RETUR',
          referenceNumber: header.returnNumber,
          notes: `Pembatalan Retur Internal ${header.returnNumber} — hutang kembali. Alasan: ${reason}`,
          paidAt: now,
        })
        .returning({ id: interBranchPayments.id })
      reversalPaymentId = payment.id
    }

    if (header.creditAmount > 0) {
      // Dua penjaga: sisa saldo milik dokumen ini (jejak pemakaian per dokumen) dan saldo pasangan cabang.
      const balance = Math.min(
        await internalCreditRemainingOfReturn(tx, header.id),
        await internalCreditBalance(tx, header.receiverBranchId, header.senderBranchId),
      )
      if (balance < header.creditAmount)
        throw new InternalReturnError(
          `Saldo Internal dari retur ini sudah terpakai memotong tagihan lain (sisa Rp ${Math.max(0, balance).toLocaleString('id-ID')} ` +
          `dari Rp ${header.creditAmount.toLocaleString('id-ID')}). Pembatalan ditolak — perbaiki dengan dokumen baru.`,
          409,
        )
      await tx.insert(internalCreditEntries).values({
        debtorBranchId: header.receiverBranchId,
        creditorBranchId: header.senderBranchId,
        amount: -header.creditAmount,
        sourceType: 'BATAL_RETUR',
        internalReturnId: header.id,
        note: `Pembatalan Retur Internal ${header.returnNumber}`,
        createdById: userId,
        createdAt: now,
      })
    }

    // Hutang yang terbuka lagi ikut dipotong bila pasangan cabang ini masih punya saldo dari retur lain.
    await applyInternalCredit(tx, {
      debtorBranchId: header.receiverBranchId,
      creditorBranchId: header.senderBranchId,
      userId,
      now,
    })

    const [updated] = await tx
      .update(internalReturns)
      .set({ status: 'CANCELLED', cancelledById: userId, cancelledAt: now, cancellationReason: reason })
      .where(and(eq(internalReturns.id, id), eq(internalReturns.status, 'APPROVED')))
      .returning()

    await tx.insert(auditLogs).values({
      branchId: header.receiverBranchId,
      userId,
      action: 'INTERNAL_RETURN_CANCEL',
      tableName: 'internal_returns',
      recordId: String(id),
      newData: JSON.stringify({
        returnNumber: header.returnNumber,
        reason,
        payableDeduction: header.payableDeduction,
        creditAmount: header.creditAmount,
        reversalPaymentId,
      }),
    })
    return updated
  })
}

export function internalReturnErrorResponse(error: unknown): { error: string; status: number } | null {
  if (error instanceof InternalReturnError) return { error: error.message, status: error.status }
  if (error instanceof InsufficientStockError)
    return { error: `Stok tidak cukup untuk salah satu barang (produk #${error.productId}).`, status: 409 }
  if (error instanceof StockConflictError) return { error: error.message, status: 409 }
  return null
}
