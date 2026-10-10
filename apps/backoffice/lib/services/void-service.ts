import { lockProductStocks } from './stock-lock'
import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  productStocks,
  products,
  productUomConversions,
  customerDebts,
  auditLogs,
  shifts,
  interBranchTransfers,
  interBranchTransferItems,
  voidRequests,
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
      | 'CONVERSION_MISSING'
      | 'DEBT_HAS_PAYMENT'
      | 'IBT_ALREADY_PROGRESSED',
    message: string,
  ) {
    super(message)
    this.name = 'VoidError'
  }
}

// Status IBT tertaut yang barangnya belum keluar gudang — nota bulk sale-nya masih boleh di-void.
export const IBT_RESETTABLE_STATUSES = ['APPROVED', 'PREPARING']

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
    // Pengajuan yang sedang diproses oleh pemanggil (jalur approval) — jangan ikut
    // di-auto-reject oleh langkah 5 di bawah, biar pemanggil sendiri yang menandainya APPROVED.
    excludeVoidRequestId?: number
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

  // Reverse-lookup: transaksi ini bisa jadi nota bulk sale hasil pemenuhan IBT (G4 — lihat
  // transaction-service.ts). `convertedTransactionId` diisi tepat sekali per transaksi (guarded
  // `IS NULL` saat pembuatan bulk sale), jadi query ini menemukan maksimal satu baris.
  const [linkedIbt] = await tx
    .select({
      id: interBranchTransfers.id,
      ibtNumber: interBranchTransfers.ibtNumber,
      status: interBranchTransfers.status,
    })
    .from(interBranchTransfers)
    .where(eq(interBranchTransfers.convertedTransactionId, txId))
    .for('update')
    .limit(1)

  // Kalau transfernya sudah dikirim/diterima sejak nota ini dibuat, barang sudah bergerak fisik
  // antar cabang. Reset otomatis ke PENDING_APPROVAL di kondisi itu menyesatkan (seolah belum
  // terjadi apa-apa) — blokir void. PREPARING masih aman: "Mulai Persiapan" cuma ganti status,
  // stok & piutang belum disentuh apa pun selain nota ini sendiri (kanban #42).
  if (linkedIbt && !IBT_RESETTABLE_STATUSES.includes(linkedIbt.status)) {
    throw new VoidError(
      'IBT_ALREADY_PROGRESSED',
      `Transaksi ini adalah pemenuhan transfer internal ${linkedIbt.ibtNumber} yang sudah diproses lebih lanjut (status: ${linkedIbt.status}). Batalkan/koreksi transfer internal tersebut secara manual sebelum membatalkan nota ini.`,
    )
  }

  // Batalkan hutang customer yang terbit dari transaksi ini. Kunci barisnya agar
  // tidak balapan dengan pencatatan pembayaran hutang. Jika hutang sudah menerima
  // pembayaran (uang riil sudah masuk), void diblokir dan harus dikoreksi manual dulu.
  const debtRows = await tx
    .select({
      id: customerDebts.id,
      paidAmount: customerDebts.paidAmount,
      status: customerDebts.status,
    })
    .from(customerDebts)
    .where(eq(customerDebts.transactionId, txId))
    .for('update')

  const activeDebts = debtRows.filter((d) => d.status !== 'VOIDED')
  if (activeDebts.some((d) => d.paidAmount > 0)) {
    throw new VoidError(
      'DEBT_HAS_PAYMENT',
      'Transaksi tidak dapat dibatalkan karena hutang customer sudah menerima pembayaran. Batalkan atau koreksi pembayaran hutang terlebih dahulu.',
    )
  }

  const debtIdsToCancel = activeDebts.map((d) => d.id)
  if (debtIdsToCancel.length > 0) {
    await tx
      .update(customerDebts)
      .set({ status: 'VOIDED', remainingAmount: 0 })
      .where(inArray(customerDebts.id, debtIdsToCancel))
  }

  const identities = await tx.select({ productId: transactionItems.productId }).from(transactionItems)
    .where(eq(transactionItems.transactionId, txId))
  await lockProductStocks(tx, branchId, identities.map(i => i.productId).filter((id): id is number => id !== null))

  const items = await tx
    .select({
      productId: transactionItems.productId,
      uomId: transactionItems.uomId,
      qty: transactionItems.qty,
      cogs: transactionItems.cogs,
    })
    .from(transactionItems)
    // Item yang sudah dihapus lewat koreksi transaksi stoknya sudah dikembalikan saat
    // koreksi — mengembalikannya lagi di sini berarti stok bertambah dua kali.
    .where(and(eq(transactionItems.transactionId, txId), eq(transactionItems.isRemoved, false)))

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

    // Barang yang kembali melunasi shortfall terbuka produk ini dulu (termasuk shortfall milik
    // nota ini sendiri bila dulu oversell), baru sisanya jadi batch — lihat AddStockOptions.
    await StockService.addStock(
      tx,
      branchId,
      item.productId,
      baseUomId,
      String(baseQtyToReturn),
      costPricePerUnit,
      undefined,
      undefined,
      { settleShortfalls: true, settleShortfallsReferenceType: 'VOID_REVERSAL', settleShortfallsReferenceId: txId },
    )
  }

  // 3. Reset IBT yang tertaut (kalau ada) ke kondisi sebelum diproses via bulk sale, supaya
  // cabang asal bisa memproses ulang dari awal — alih-alih request cabang tujuan buntu karena
  // menunjuk ke nota yang sudah VOIDED. Guard status di atas memastikan ini hanya jalan saat
  // barangnya belum dikirim.
  if (linkedIbt) {
    await tx
      .update(interBranchTransfers)
      .set({
        convertedTransactionId: null,
        status: 'PENDING_APPROVAL',
        approvedById: null,
        updatedAt: new Date(),
      })
      .where(eq(interBranchTransfers.id, linkedIbt.id))

    // Baris "barang tambahan" (qtyRequested 0) hanya lahir dari konversi nota ini
    // (planIbtPriceSync) — form PO Internal mensyaratkan qty minimal 1. Ikut dibuang
    // supaya proses ulang mulai dari isi permintaan asli.
    await tx
      .delete(interBranchTransferItems)
      .where(
        and(
          eq(interBranchTransferItems.transferId, linkedIbt.id),
          eq(interBranchTransferItems.qtyRequested, 0),
        ),
      )
  }

  // 4. Audit log
  await tx.insert(auditLogs).values({
    branchId,
    userId: actorUserId,
    action: params.auditAction ?? 'VOID_TRANSACTION',
    tableName: 'transactions',
    recordId: String(txId),
    newData: JSON.stringify({
      trxNumber,
      voidedBy: actorUserId,
      ...(linkedIbt ? { ibtReset: { id: linkedIbt.id, ibtNumber: linkedIbt.ibtNumber } } : {}),
      ...(params.auditNewData ?? {}),
    }),
  })

  // 5. Pengajuan approval lain yang masih PENDING untuk transaksi ini kini basi: transaksi
  // sudah VOIDED lewat jalur ini (mis. owner input PIN langsung di POS setelah kasir
  // sebelumnya mengajukan void untuk disetujui). `assertVoidable`/langkah re-check status di
  // atas akan selalu menolak transaksi yang sudah VOIDED, jadi pengajuan itu tidak akan pernah
  // bisa disetujui lagi — kalau dibiarkan, ia nyangkut selamanya di halaman persetujuan.
  // Tandai REJECTED otomatis di sini supaya hilang dari antrean.
  const stalePending = await tx
    .select({ id: voidRequests.id, requestById: voidRequests.requestById })
    .from(voidRequests)
    .where(and(eq(voidRequests.transactionId, txId), eq(voidRequests.status, 'PENDING')))

  for (const stale of stalePending) {
    if (stale.id === params.excludeVoidRequestId) continue

    await tx
      .update(voidRequests)
      .set({ status: 'REJECTED', approvedById: actorUserId, updatedAt: new Date() })
      .where(eq(voidRequests.id, stale.id))

    await tx.insert(auditLogs).values({
      branchId,
      userId: actorUserId,
      action: 'VOID_REQUEST_AUTO_REJECTED',
      tableName: 'void_requests',
      recordId: String(stale.id),
      newData: JSON.stringify({
        trxNumber,
        requestById: stale.requestById,
        note: 'Transaksi sudah divoid lewat jalur lain sebelum pengajuan ini diputuskan',
      }),
    })
  }
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
