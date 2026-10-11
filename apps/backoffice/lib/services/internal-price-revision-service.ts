import Big from 'big.js'
import { z } from 'zod'
import {
  db,
  internalReturns,
  internalReturnItems,
  internalReturnBatchAdjustments,
  interBranchTransfers,
  interBranchPayables,
  productStockBatches,
  auditLogs,
  eq,
  and,
  ne,
  gte,
  lte,
  inArray,
  isNull,
  sql,
} from '@/lib/db'
import { isUniqueViolation } from '@/lib/po-number'
import { lockStockPairs } from '@/lib/services/stock-lock'
import { resolveStockUom } from '@/lib/services/stock-validation'
import { syncCostFromInbound } from '@/lib/services/cost-sync-service'
import { applyInternalCredit, lockInternalCreditPair } from '@/lib/services/internal-credit-service'
import {
  INTERNAL_RETURN_KIND_GOODS,
  INTERNAL_RETURN_KIND_PRICE,
  InternalReturnError,
  assertActorBranch,
  assertReturnableTransfer,
  findReturnableTransfer,
  generateInternalReturnNumber,
  hasLaterApprovedDocument,
  loadReturnableTransferItems,
  returnedQtyByTransferItem,
  reverseInternalReturnValue,
  settleInternalReturnValue,
  type InternalReturnActor,
} from '@/lib/services/internal-return-service'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

/**
 * Retur Internal — "Revisi Harga Beli" (RI8, docs/work/specs/2026-10-11-retur-internal-design.md
 * bagian B). Harga nota Bulk Sale kiriman antar cabang salah (mis. Gudang memakai harga retail).
 * Stok TIDAK bergerak. Bukan edit nota: dokumen dengan harga usulan pemohon, harga final penyetuju.
 *
 * Disetujui (Owner/GM) dalam satu transaksi DB:
 * - sisa batch kiriman itu di cabang penerima: modalnya diganti ke harga final (jejak per batch);
 * - bagian kiriman yang sudah terpakai: "Penyesuaian Modal (Revisi Harga Beli)" di Laba Rugi
 *   cabang penerima pada tanggal disetujui (nota penjualan lama tidak diubah);
 * - hutang internal kiriman itu: harga TURUN → dipotong qty × selisih, kelebihannya jadi Saldo
 *   Internal yang langsung memotong tagihan lain; harga NAIK → tagihan bertambah;
 * - omzet cabang pengirim dikoreksi sebesar selisih di Laba Rugi (lewat dokumen ini);
 * - modal terbaru cabang penerima (Manajemen Harga) ikut dibetulkan bila kiriman ini masih yang terbaru.
 *
 * Dibatalkan hanya bila bisa dibalik bersih (batch belum berubah, saldo belum terpakai, belum ada
 * dokumen lain sesudahnya untuk barang yang sama). Kalau tidak, perbaikannya revisi baru.
 */

export const PRICE_REVISION_REASON = 'SALAH_HARGA'

/** Batch lama (sebelum migrasi 0035) dicocokkan lewat waktu terima kiriman, dalam jendela ini. */
const LEGACY_BATCH_WINDOW_BEFORE_MS = 5 * 60 * 1000
const LEGACY_BATCH_WINDOW_AFTER_MS = 2 * 60 * 1000

export const priceRevisionRequestSchema = z.object({
  transferId: z.number().int().positive('Cari kode transaksi asal dulu'),
  notes: z.string().trim().min(5, 'Jelaskan alasan revisi harga (minimal 5 huruf)').max(500, 'Penjelasan maksimal 500 karakter'),
  items: z
    .array(
      z.object({
        transferItemId: z.number().int().positive(),
        proposedUnitPrice: z.number().int('Harga harus angka bulat').positive('Harga yang benar harus lebih dari 0'),
      }),
    )
    .min(1, 'Minimal satu barang yang direvisi harganya')
    .max(100, 'Maksimal 100 barang per revisi'),
})
export type PriceRevisionRequest = z.infer<typeof priceRevisionRequestSchema>

export const priceRevisionApproveSchema = z.object({
  finalPrices: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        finalUnitPrice: z.number().int('Harga harus angka bulat').positive('Harga final harus lebih dari 0'),
      }),
    )
    .max(100)
    .optional(),
})

/** Baris dokumen revisi lain yang masih MENUNGGU untuk baris kiriman ini (satu revisi menunggu per barang). */
async function pendingRevisionItems(executor: Executor, transferItemIds: number[], excludeReturnId?: number) {
  const set = new Set<number>()
  if (transferItemIds.length === 0) return set
  const rows = await executor
    .select({ transferItemId: internalReturnItems.transferItemId })
    .from(internalReturnItems)
    .innerJoin(internalReturns, eq(internalReturnItems.internalReturnId, internalReturns.id))
    .where(and(
      inArray(internalReturnItems.transferItemId, transferItemIds),
      eq(internalReturns.kind, INTERNAL_RETURN_KIND_PRICE),
      eq(internalReturns.status, 'PENDING'),
      excludeReturnId ? ne(internalReturns.id, excludeReturnId) : undefined,
    ))
  for (const r of rows) set.add(r.transferItemId)
  return set
}

/**
 * Baris kiriman yang bisa direvisi harganya. `unitPrice` = harga yang berlaku sekarang (harga nota
 * atau harga final revisi sebelumnya); `revisableQty` = qty diterima − yang sudah dikembalikan
 * (Barang Dikembalikan yang DISETUJUI). Dipakai form (RI9) dan validasi.
 */
export async function loadRevisableTransferItems(executor: Executor, transferId: number, excludeReturnId?: number) {
  const items = await loadReturnableTransferItems(executor, transferId, excludeReturnId)
  const ids = items.map(i => i.id)
  const returned = await returnedQtyByTransferItem(executor, ids, undefined, ['APPROVED'])
  const pending = await pendingRevisionItems(executor, ids, excludeReturnId)
  return items.map(i => ({
    id: i.id,
    productId: i.productId,
    productName: i.productName,
    uomId: i.uomId,
    uomCode: i.uomCode,
    qtyReceived: i.qtyReceived,
    notaUnitPrice: i.notaUnitPrice,
    unitPrice: i.unitPrice,
    revisableQty: Math.max(0, i.qtyReceived - (returned.get(i.id) ?? 0)),
    hasPendingRevision: pending.has(i.id),
  }))
}

/** Cari kiriman dari kode transaksi untuk form Revisi Harga Beli: barang + harga yang berlaku sekarang. */
export async function findRevisableTransfer(code: string, actor: InternalReturnActor) {
  const found = await findReturnableTransfer(code, actor)
  return { ...found, items: await loadRevisableTransferItems(db, found.transfer.id) }
}

const lineValueOf = (qty: number, oldPrice: number, newPrice: number) =>
  Math.round(new Big(oldPrice).minus(newPrice).times(qty).toNumber())

export async function createPriceRevisionRequest(params: {
  input: PriceRevisionRequest
  actor: InternalReturnActor
  source: 'POS' | 'BO'
}) {
  const { input, actor, source } = params
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [transfer] = await tx
          .select()
          .from(interBranchTransfers)
          .where(eq(interBranchTransfers.id, input.transferId))
          .for('update')
          .limit(1)
        if (!transfer) throw new InternalReturnError('Kiriman tidak ditemukan', 404)
        assertActorBranch(actor, transfer)
        const { sale, payable } = await assertReturnableTransfer(tx, transfer)

        const available = new Map((await loadRevisableTransferItems(tx, transfer.id)).map(i => [i.id, i]))
        const seen = new Set<number>()
        const lines = input.items.map(item => {
          const row = available.get(item.transferItemId)
          if (!row) throw new InternalReturnError('Barang yang direvisi harus dipilih dari daftar barang kiriman ini')
          if (seen.has(row.id)) throw new InternalReturnError(`${row.productName} dipilih dua kali`)
          seen.add(row.id)
          if (row.hasPendingRevision)
            throw new InternalReturnError(`${row.productName} masih punya pengajuan Revisi Harga Beli yang menunggu persetujuan`, 409)
          if (row.revisableQty <= 0)
            throw new InternalReturnError(`${row.productName} dari kiriman ini sudah habis dikembalikan — tidak ada yang direvisi`)
          if (item.proposedUnitPrice === row.unitPrice)
            throw new InternalReturnError(`Harga usulan ${row.productName} sama dengan harga sekarang`)
          return { row, proposedUnitPrice: item.proposedUnitPrice, lineValue: lineValueOf(row.revisableQty, row.unitPrice, item.proposedUnitPrice) }
        })

        const totalValue = lines.reduce((sum, l) => sum + l.lineValue, 0)
        const returnNumber = await generateInternalReturnNumber(tx)
        const [header] = await tx
          .insert(internalReturns)
          .values({
            returnNumber,
            kind: INTERNAL_RETURN_KIND_PRICE,
            transferId: transfer.id,
            saleTransactionId: sale.id,
            payableId: payable?.id ?? null,
            requestBranchId: actor.branchId,
            receiverBranchId: transfer.destinationBranchId,
            senderBranchId: transfer.sourceBranchId,
            reason: PRICE_REVISION_REASON,
            notes: input.notes,
            source,
            status: 'PENDING',
            totalValue,
            requestedById: actor.userId,
          })
          .returning()
        await tx.insert(internalReturnItems).values(
          lines.map(l => ({
            internalReturnId: header.id,
            transferItemId: l.row.id,
            productId: l.row.productId,
            uomId: l.row.uomId,
            qty: l.row.revisableQty,
            oldUnitPrice: l.row.unitPrice,
            proposedUnitPrice: l.proposedUnitPrice,
            lineValue: l.lineValue,
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
            kind: INTERNAL_RETURN_KIND_PRICE,
            ibtNumber: transfer.ibtNumber,
            trxNumber: sale.trxNumber,
            totalValue,
            source,
          }),
        })
        return header
      })
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 2) continue
      throw error
    }
  }
  throw new InternalReturnError('Gagal membuat nomor revisi harga, coba lagi', 500)
}

async function lockPriceRevision(tx: Tx, id: number, expectedStatus: string, notFound: string) {
  const [header] = await tx.select().from(internalReturns).where(eq(internalReturns.id, id)).for('update').limit(1)
  if (!header) throw new InternalReturnError(notFound, 404)
  if (header.kind !== INTERNAL_RETURN_KIND_PRICE) throw new InternalReturnError('Dokumen ini bukan Revisi Harga Beli')
  if (header.status !== expectedStatus)
    throw new InternalReturnError(
      expectedStatus === 'PENDING' ? 'Pengajuan ini sudah diproses sebelumnya' : 'Hanya revisi berstatus Disetujui yang bisa dibatalkan',
      409,
    )
  // Urutan kunci sama dengan Barang Dikembalikan & terima transfer: kiriman → stok → saldo → hutang.
  const [transfer] = await tx.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, header.transferId)).for('update').limit(1)
  if (!transfer) throw new InternalReturnError('Kiriman asal tidak ditemukan', 404)
  const items = await tx.select().from(internalReturnItems).where(eq(internalReturnItems.internalReturnId, id)).orderBy(internalReturnItems.id)
  return { header, transfer, items }
}

type BatchRow = typeof productStockBatches.$inferSelect

/**
 * Batch di cabang penerima yang berasal dari satu baris kiriman dan masih bermodal harga lama.
 * Batch baru tertaut langsung (`transfer_item_id`, migrasi 0035). Kiriman lama belum punya tautan:
 * dicocokkan lewat cabang + produk + satuan + modal + waktu terima, dibatasi qty yang diterima.
 * Batch yang tidak ditemukan / modalnya sudah diubah orang dianggap sudah terpakai.
 */
async function findShipmentBatches(tx: Executor, params: {
  receiverBranchId: number
  transferItemId: number
  productId: number
  uomId: number
  expectedCostBase: number
  receivedQtyBase: number
  receivedAt: Date | null
  claimed: Set<number>
  /** false = hanya membaca (pratinjau popup penyetuju), tanpa mengunci baris batch. */
  lock?: boolean
}): Promise<BatchRow[]> {
  const { receiverBranchId, transferItemId, productId, uomId, expectedCostBase, receivedQtyBase, receivedAt, claimed, lock = true } = params
  const linkedQuery = tx
    .select()
    .from(productStockBatches)
    .where(and(eq(productStockBatches.transferItemId, transferItemId), eq(productStockBatches.branchId, receiverBranchId)))
    .orderBy(productStockBatches.id)
  const linked = await (lock ? linkedQuery.for('update') : linkedQuery)
  if (linked.length > 0) return linked.filter(b => b.costPrice === expectedCostBase && b.qtyRemaining > 0)
  if (!receivedAt) return []

  const candidateQuery = tx
    .select()
    .from(productStockBatches)
    .where(and(
      eq(productStockBatches.branchId, receiverBranchId),
      eq(productStockBatches.productId, productId),
      eq(productStockBatches.uomId, uomId),
      eq(productStockBatches.costPrice, expectedCostBase),
      isNull(productStockBatches.transferItemId),
      gte(productStockBatches.receivedAt, new Date(receivedAt.getTime() - LEGACY_BATCH_WINDOW_BEFORE_MS)),
      lte(productStockBatches.receivedAt, new Date(receivedAt.getTime() + LEGACY_BATCH_WINDOW_AFTER_MS)),
    ))
    .orderBy(productStockBatches.id)
  const candidates = await (lock ? candidateQuery.for('update') : candidateQuery)
  const byCloseness = candidates
    .filter(b => !claimed.has(b.id))
    .sort((a, b) => Math.abs(a.receivedAt.getTime() - receivedAt.getTime()) - Math.abs(b.receivedAt.getTime() - receivedAt.getTime()) || a.id - b.id)
  const picked: BatchRow[] = []
  let total = 0
  for (const batch of byCloseness) {
    if (total + batch.qtyReceived > receivedQtyBase) continue
    total += batch.qtyReceived
    picked.push(batch)
  }
  return picked.filter(b => b.qtyRemaining > 0)
}

/**
 * Pratinjau untuk popup penyetuju (RI9): keadaan kiriman SAAT INI per baris dokumen yang masih
 * menunggu — harga yang berlaku, qty yang direvisi, dan berapa yang masih ada di stok penerima
 * (sisanya sudah terjual / terpakai → jadi Penyesuaian Modal). Hanya membaca; angka pastinya
 * dihitung ulang saat disetujui. Hitung per harga final: `estimatePriceRevisionLine`.
 */
export async function previewPriceRevision(id: number) {
  // Transaksi baca saja (tanpa kunci baris) supaya semua angka diambil dari satu keadaan.
  return db.transaction(async (tx) => {
    const [header] = await tx.select().from(internalReturns).where(eq(internalReturns.id, id)).limit(1)
    if (!header) throw new InternalReturnError('Pengajuan revisi harga tidak ditemukan', 404)
    if (header.kind !== INTERNAL_RETURN_KIND_PRICE) throw new InternalReturnError('Dokumen ini bukan Revisi Harga Beli')
    if (header.status !== 'PENDING') throw new InternalReturnError('Pengajuan ini sudah diproses sebelumnya', 409)
    const [transfer] = await tx.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, header.transferId)).limit(1)
    if (!transfer) throw new InternalReturnError('Kiriman asal tidak ditemukan', 404)
    const items = await tx.select().from(internalReturnItems).where(eq(internalReturnItems.internalReturnId, id)).orderBy(internalReturnItems.id)
    const available = new Map((await loadRevisableTransferItems(tx, transfer.id, id)).map(i => [i.id, i]))

    const claimed = new Set<number>()
    const lines: {
      itemId: number
      qty: number
      ratio: number
      currentUnitPrice: number
      proposedUnitPrice: number
      remainingBase: number
    }[] = []
    for (const item of items) {
      const row = available.get(item.transferItemId)
      const qty = row?.revisableQty ?? 0
      const currentUnitPrice = row?.unitPrice ?? item.oldUnitPrice
      const ratioNum = Number((await resolveStockUom(tx, item.productId, item.uomId)).ratio)
      const batches = !row || qty <= 0 ? [] : await findShipmentBatches(tx, {
        receiverBranchId: header.receiverBranchId,
        transferItemId: item.transferItemId,
        productId: item.productId,
        uomId: item.uomId,
        expectedCostBase: Math.round(new Big(currentUnitPrice).div(ratioNum).toNumber()),
        receivedQtyBase: Math.round(new Big(row.qtyReceived).times(ratioNum).toNumber()),
        receivedAt: transfer.receivedAt,
        claimed,
        lock: false,
      })
      for (const batch of batches) claimed.add(batch.id)
      lines.push({
        itemId: item.id,
        qty,
        ratio: ratioNum,
        currentUnitPrice,
        proposedUnitPrice: item.proposedUnitPrice ?? currentUnitPrice,
        remainingBase: batches.reduce((sum, b) => sum + b.qtyRemaining, 0),
      })
    }
    return { id: header.id, returnNumber: header.returnNumber, items: lines }
  })
}

export async function approvePriceRevision(params: {
  id: number
  userId: number
  /** Harga final per baris dokumen; baris yang tidak disebut memakai harga usulan pemohon. */
  finalPrices?: { itemId: number; finalUnitPrice: number }[]
}) {
  const { id, userId } = params
  return db.transaction(async (tx) => {
    const { header, transfer, items } = await lockPriceRevision(tx, id, 'PENDING', 'Pengajuan revisi harga tidak ditemukan')
    const { sale } = await assertReturnableTransfer(tx, transfer)

    const finalByItem = new Map((params.finalPrices ?? []).map(f => [f.itemId, f.finalUnitPrice]))
    for (const itemId of finalByItem.keys())
      if (!items.some(it => it.id === itemId)) throw new InternalReturnError('Harga final menunjuk barang yang bukan bagian dokumen ini')

    // Harga & qty dihitung ulang dari keadaan SAAT INI (dokumen lain bisa disetujui lebih dulu).
    const available = new Map((await loadRevisableTransferItems(tx, transfer.id, id)).map(i => [i.id, i]))
    await lockStockPairs(tx, items.map(it => ({ branchId: header.receiverBranchId, productId: it.productId })))

    const now = new Date()
    const claimed = new Set<number>()
    let totalValue = 0
    let totalCogsAdjustment = 0
    const summary: { productId: number; qty: number; oldUnitPrice: number; finalUnitPrice: number; qtyConsumedBase: number; cogsAdjustment: number; batchIds: number[] }[] = []

    for (const item of items) {
      const row = available.get(item.transferItemId)
      if (!row || row.revisableQty <= 0)
        throw new InternalReturnError(`${row?.productName ?? `Produk #${item.productId}`} dari kiriman ini sudah habis dikembalikan — tidak ada yang direvisi`, 409)
      const oldUnitPrice = row.unitPrice
      const finalUnitPrice = finalByItem.get(item.id) ?? item.proposedUnitPrice
      if (!finalUnitPrice || finalUnitPrice <= 0) throw new InternalReturnError(`Harga final ${row.productName} belum diisi`)
      if (finalUnitPrice === oldUnitPrice)
        throw new InternalReturnError(`Harga final ${row.productName} sama dengan harga sekarang — tidak ada yang direvisi. Tolak pengajuan ini bila harganya sudah benar.`, 409)

      const qty = row.revisableQty
      const lineValue = lineValueOf(qty, oldUnitPrice, finalUnitPrice)
      const { ratio } = await resolveStockUom(tx, item.productId, item.uomId)
      const ratioNum = Number(ratio)
      const oldCostBase = Math.round(new Big(oldUnitPrice).div(ratioNum).toNumber())
      const newCostBase = Math.round(new Big(finalUnitPrice).div(ratioNum).toNumber())
      const qtyBase = Math.round(new Big(qty).times(ratioNum).toNumber())

      // 1. Sisa batch kiriman ini: modal diganti ke harga final. Stok tidak bergerak.
      const batches = await findShipmentBatches(tx, {
        receiverBranchId: header.receiverBranchId,
        transferItemId: item.transferItemId,
        productId: item.productId,
        uomId: item.uomId,
        expectedCostBase: oldCostBase,
        receivedQtyBase: Math.round(new Big(row.qtyReceived).times(ratioNum).toNumber()),
        receivedAt: transfer.receivedAt,
        claimed,
      })
      let remainingBase = 0
      let batchCorrection = 0
      for (const batch of batches) {
        claimed.add(batch.id)
        remainingBase += batch.qtyRemaining
        batchCorrection += batch.qtyRemaining * (oldCostBase - newCostBase)
        if (newCostBase !== oldCostBase)
          await tx.update(productStockBatches).set({ costPrice: newCostBase }).where(eq(productStockBatches.id, batch.id))
        await tx.insert(internalReturnBatchAdjustments).values({
          internalReturnId: header.id,
          internalReturnItemId: item.id,
          batchId: batch.id,
          oldCostPrice: oldCostBase,
          newCostPrice: newCostBase,
          qtyRemaining: batch.qtyRemaining,
          createdAt: now,
        })
      }

      // 2. Bagian yang sudah terpakai → Penyesuaian Modal. Dihitung sebagai sisa nilai baris supaya
      //    koreksi stok + penyesuaian modal selalu sama persis dengan perubahan hutang (pembulatan
      //    satuan dasar ikut masuk ke sini).
      const qtyConsumedBase = Math.max(0, qtyBase - remainingBase)
      const cogsAdjustment = lineValue - batchCorrection
      totalValue += lineValue
      totalCogsAdjustment += cogsAdjustment
      await tx
        .update(internalReturnItems)
        .set({ qty, oldUnitPrice, finalUnitPrice, lineValue, qtyConsumed: qtyConsumedBase, cogsAdjustment })
        .where(eq(internalReturnItems.id, item.id))

      // 3. Modal terbaru cabang penerima (Manajemen Harga) — hanya bila kiriman ini masih barang
      //    masuk terbaru produk itu; lompatan ≥ 30% tetap lewat Tinjauan Modal.
      await syncCostFromInbound(tx, {
        branchId: header.receiverBranchId,
        productId: item.productId,
        uomId: item.uomId,
        unitCost: finalUnitPrice,
        sourceType: 'IBT_RECEIVE',
        sourceId: transfer.id,
        sourceRef: `${header.returnNumber} (revisi harga ${transfer.ibtNumber})`,
        actorUserId: userId,
        effectiveAt: transfer.receivedAt ?? now,
      })
      summary.push({ productId: item.productId, qty, oldUnitPrice, finalUnitPrice, qtyConsumedBase, cogsAdjustment, batchIds: batches.map(b => b.id) })
    }

    // 4. Hutang internal kiriman itu.
    let payableId: number | null = header.payableId
    let payableDeduction = 0
    let creditAmount = 0
    let paymentId: number | null = null
    let creditUsed = 0
    if (totalValue >= 0) {
      // Harga turun: potong hutang, kelebihannya jadi Saldo Internal yang langsung dipakai (RI7).
      const settled = await settleInternalReturnValue(tx, {
        header, transfer, saleTrxNumber: sale.trxNumber, value: totalValue, userId, now, docLabel: 'Revisi Harga Beli',
      })
      payableId = settled.payable?.id ?? null
      payableDeduction = settled.payableDeduction
      creditAmount = settled.creditAmount
      paymentId = settled.paymentId
      creditUsed = settled.creditUsages.reduce((sum, u) => sum + u.amount, 0)
    } else {
      // Harga naik: tagihan kiriman itu bertambah; saldo lain yang masih ada langsung memotongnya.
      const increase = -totalValue
      await lockInternalCreditPair(tx, header.receiverBranchId, header.senderBranchId)
      const [payable] = await tx.select().from(interBranchPayables).where(eq(interBranchPayables.transferId, transfer.id)).for('update').limit(1)
      if (!payable) throw new InternalReturnError('Hutang internal kiriman ini tidak ditemukan', 409)
      await tx
        .update(interBranchPayables)
        .set({
          totalAmount: sql`${interBranchPayables.totalAmount} + ${increase}`,
          status: sql`CASE WHEN ${interBranchPayables.paidAmount} >= ${interBranchPayables.totalAmount} + ${increase} THEN 'PAID'
            WHEN ${interBranchPayables.paidAmount} > 0 THEN 'PARTIAL' ELSE 'UNPAID' END`,
          updatedAt: now,
        })
        .where(eq(interBranchPayables.id, payable.id))
      payableId = payable.id
      payableDeduction = totalValue
      const usages = await applyInternalCredit(tx, { debtorBranchId: header.receiverBranchId, creditorBranchId: header.senderBranchId, userId, now })
      creditUsed = usages.reduce((sum, u) => sum + u.amount, 0)
    }

    const [updated] = await tx
      .update(internalReturns)
      .set({
        status: 'APPROVED',
        totalValue,
        payableId,
        payableDeduction,
        creditAmount,
        cogsAdjustment: totalCogsAdjustment,
        payablePaymentId: paymentId,
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
        kind: INTERNAL_RETURN_KIND_PRICE,
        ibtNumber: transfer.ibtNumber,
        totalValue,
        payableDeduction,
        creditAmount,
        cogsAdjustment: totalCogsAdjustment,
        payableId,
        creditUsed,
        items: summary,
      }),
    })
    return updated
  })
}

const CANCEL_NOT_CLEAN =
  'pembatalan ditolak. Perbaiki dengan Revisi Harga Beli baru yang mengembalikan harganya.'

/**
 * Batalkan Revisi Harga Beli yang sudah DISETUJUI (Owner/GM, alasan wajib). Modal batch dikembalikan,
 * potongan hutang / Saldo Internal / kenaikan tagihan dibalik, dokumen jadi Dibatalkan (koreksi
 * Laba Rugi-nya ikut hilang). Ditolak bila tidak bisa dibalik bersih: batch kiriman sudah berubah
 * sejak revisi (terjual / modal diganti), sudah ada revisi atau Barang Dikembalikan lain sesudahnya
 * untuk barang yang sama, atau saldonya sudah terpakai.
 */
export async function cancelPriceRevision(params: { id: number; userId: number; reason: string }) {
  const { id, userId, reason } = params
  return db.transaction(async (tx) => {
    const { header, transfer, items } = await lockPriceRevision(tx, id, 'APPROVED', 'Revisi harga tidak ditemukan')
    const now = new Date()
    const transferItemIds = items.map(it => it.transferItemId)

    if (await hasLaterApprovedDocument(tx, { transferItemIds, kind: INTERNAL_RETURN_KIND_PRICE, after: header }))
      throw new InternalReturnError(`Barang di dokumen ini sudah direvisi lagi sesudahnya — ${CANCEL_NOT_CLEAN}`, 409)
    if (await hasLaterApprovedDocument(tx, { transferItemIds, kind: INTERNAL_RETURN_KIND_GOODS, after: header }))
      throw new InternalReturnError(`Sebagian barang kiriman ini sudah dikembalikan dengan harga hasil revisi — ${CANCEL_NOT_CLEAN}`, 409)

    await lockStockPairs(tx, items.map(it => ({ branchId: header.receiverBranchId, productId: it.productId })))

    // 1. Modal batch kembali ke sebelum revisi — hanya bila batch belum berubah sejak itu.
    const adjustments = await tx
      .select()
      .from(internalReturnBatchAdjustments)
      .where(eq(internalReturnBatchAdjustments.internalReturnId, id))
      .orderBy(internalReturnBatchAdjustments.id)
    for (const adj of adjustments) {
      const [batch] = await tx.select().from(productStockBatches).where(eq(productStockBatches.id, adj.batchId)).for('update').limit(1)
      if (!batch || batch.costPrice !== adj.newCostPrice || batch.qtyRemaining !== adj.qtyRemaining)
        throw new InternalReturnError(`Stok kiriman ini sudah berubah sejak revisi disetujui (terjual / dipakai) — ${CANCEL_NOT_CLEAN}`, 409)
      if (adj.oldCostPrice !== adj.newCostPrice)
        await tx.update(productStockBatches).set({ costPrice: adj.oldCostPrice }).where(eq(productStockBatches.id, adj.batchId))
    }

    for (const item of items) {
      await syncCostFromInbound(tx, {
        branchId: header.receiverBranchId,
        productId: item.productId,
        uomId: item.uomId,
        unitCost: item.oldUnitPrice,
        sourceType: 'IBT_RECEIVE',
        sourceId: transfer.id,
        sourceRef: `${header.returnNumber} dibatalkan (${transfer.ibtNumber})`,
        actorUserId: userId,
        effectiveAt: transfer.receivedAt ?? now,
      })
    }

    // 2. Hutang internal.
    let reversalPaymentId: number | null = null
    if (header.totalValue >= 0) {
      reversalPaymentId = await reverseInternalReturnValue(tx, { header, userId, reason, now })
    } else {
      const increase = -header.totalValue
      await lockInternalCreditPair(tx, header.receiverBranchId, header.senderBranchId)
      const [payable] = header.payableId
        ? await tx.select().from(interBranchPayables).where(eq(interBranchPayables.id, header.payableId)).for('update').limit(1)
        : []
      if (!payable || payable.status === 'WAIVED' || payable.totalAmount - increase < payable.paidAmount)
        throw new InternalReturnError(`Kenaikan tagihan dari revisi ini sudah dibayar — ${CANCEL_NOT_CLEAN}`, 409)
      await tx
        .update(interBranchPayables)
        .set({
          totalAmount: sql`${interBranchPayables.totalAmount} - ${increase}`,
          status: sql`CASE WHEN ${interBranchPayables.paidAmount} >= ${interBranchPayables.totalAmount} - ${increase} THEN 'PAID'
            WHEN ${interBranchPayables.paidAmount} > 0 THEN 'PARTIAL' ELSE 'UNPAID' END`,
          updatedAt: now,
        })
        .where(eq(interBranchPayables.id, payable.id))
    }

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
        kind: INTERNAL_RETURN_KIND_PRICE,
        reason,
        totalValue: header.totalValue,
        payableDeduction: header.payableDeduction,
        creditAmount: header.creditAmount,
        cogsAdjustment: header.cogsAdjustment,
        reversalPaymentId,
        batchIds: adjustments.map(a => a.batchId),
      }),
    })
    return updated
  })
}
