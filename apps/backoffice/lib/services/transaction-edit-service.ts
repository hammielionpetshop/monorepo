import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  transactionPayments,
  transactionEdits,
  paymentMethods,
  customerDebts,
  products,
  productStocks,
  shifts,
  returns,
  auditLogs,
  eq,
  and,
  inArray,
  isNull,
} from '../db'
import { StockService } from './stock-service'

export type TransactionEditErrorCode =
  | 'TRX_NOT_FOUND'
  | 'TRX_NOT_COMPLETED'
  | 'SHIFT_CLOSED'
  | 'HAS_RETURN'
  | 'DEBT_HAS_PAYMENT'
  | 'LINKED_SOURCE'
  | 'NO_ITEMS'
  | 'ITEM_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'PAYMENT_INSUFFICIENT'
  | 'CUSTOMER_REQUIRED_FOR_DEBT'

export class TransactionEditError extends Error {
  constructor(
    public readonly code: TransactionEditErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TransactionEditError'
  }
}

export interface EditItemInput {
  /** null = item baru yang ditambahkan lewat koreksi ini */
  transactionItemId: number | null
  productId: number
  uomId: number
  qty: number
  unitPrice: number
  discountAmount: number
  priceTier: string
}

export interface EditPaymentInput {
  paymentMethodId: number
  amount: number
  referenceNumber?: string | null
}

export interface EditTransactionParams {
  txId: number
  branchId: number
  /** Kasir yang mengetik koreksi */
  actorUserId: number
  /** Pemilik izin `transaction.edit` yang PIN-nya diverifikasi route */
  approvedById: number | null
  reason: string
  items: EditItemInput[]
  payments: EditPaymentInput[]
  customerId?: number | null
  dueAt?: string | null
}

export interface TransactionEditResult {
  trxNumber: string
  revision: number
  payableAmount: number
  paidAmount: number
  changeAmount: number
}

interface ExistingItem {
  id: number
  productId: number | null
  productName: string | null
  productSku: string | null
  uomId: number
  qty: number
  unitPrice: number
  totalPrice: number
  discountAmount: number
  priceTier: string
  cogs: number | null
  originalQty: number | null
  originalCogs: number | null
  isRemoved: boolean
}

/**
 * Kembalikan stok ke gudang sebesar `qty` (dalam UOM item) dengan harga modal
 * yang sama seperti saat dipotong, supaya HPP batch tidak melar saat dikoreksi.
 */
async function returnStockForQty(
  tx: any,
  branchId: number,
  productId: number,
  uomId: number,
  qty: number,
  cogsForQty: number,
): Promise<void> {
  if (qty <= 0) return
  const costPerUom = new Big(cogsForQty).div(qty).toFixed(6)
  await StockService.addStock(tx, branchId, productId, uomId, String(qty), costPerUom)
}

function lineGross(qty: number, unitPrice: number): number {
  return Math.round(new Big(qty).times(unitPrice).toNumber())
}

function lineNet(qty: number, unitPrice: number, discount: number): number {
  return Math.max(0, lineGross(qty, unitPrice) - Math.round(discount))
}

export class TransactionEditService {
  /**
   * Koreksi item transaksi yang sudah tersimpan — nomor nota tetap, stok & pembayaran
   * ikut disesuaikan, riwayat revisi dicatat.
   *
   * Kasus yang ditangani: qty salah, produk salah (ganti produk/satuan), item kelebihan
   * (hapus), item terlewat (tambah). Semua dalam satu DB transaction.
   *
   * Ganti produk/satuan sengaja diperlakukan sebagai "hapus baris lama + tambah baris baru",
   * bukan update di tempat: baris lama menyimpan `original_qty` milik produk lama, jadi
   * menimpa `product_id`-nya akan memindahkan penjualan asli ke produk yang salah di buku
   * besar stok.
   */
  static async editTransaction(params: EditTransactionParams): Promise<TransactionEditResult> {
    const { txId, branchId, actorUserId, approvedById, reason } = params

    if (!Array.isArray(params.items) || params.items.length === 0) {
      throw new TransactionEditError('NO_ITEMS', 'Transaksi harus tetap memiliki minimal satu item')
    }

    return await db.transaction(async (tx) => {
      // 1. Kunci header transaksi — mencegah balapan dengan void / koreksi lain
      const [trx] = await tx
        .select({
          id: transactions.id,
          trxNumber: transactions.trxNumber,
          branchId: transactions.branchId,
          shiftId: transactions.shiftId,
          cashierId: transactions.cashierId,
          customerId: transactions.customerId,
          status: transactions.status,
          revision: transactions.revision,
          totalAmount: transactions.totalAmount,
          discountAmount: transactions.discountAmount,
          payableAmount: transactions.payableAmount,
          paidAmount: transactions.paidAmount,
          changeAmount: transactions.changeAmount,
          sourceIbtId: transactions.sourceIbtId,
          sourceOrderId: transactions.sourceOrderId,
        })
        .from(transactions)
        .where(and(eq(transactions.id, txId), eq(transactions.branchId, branchId)))
        .for('update')
        .limit(1)

      if (!trx) {
        throw new TransactionEditError('TRX_NOT_FOUND', 'Transaksi tidak ditemukan')
      }
      if (trx.status !== 'COMPLETED') {
        throw new TransactionEditError(
          'TRX_NOT_COMPLETED',
          'Hanya transaksi berstatus COMPLETED yang bisa dikoreksi',
        )
      }

      // Bulk sale hasil konversi Internal PO / order portal: harga jualnya sudah dipakai
      // sebagai modal cabang penerima, mengoreksinya akan membuat modal itu menyimpang.
      if (trx.sourceIbtId != null || trx.sourceOrderId != null) {
        throw new TransactionEditError(
          'LINKED_SOURCE',
          'Transaksi hasil konversi Internal PO atau order pelanggan tidak bisa dikoreksi. Gunakan void bila perlu dibatalkan.',
        )
      }

      // 2. Shift wajib masih terbuka — setelah shift ditutup, uangnya sudah direkap
      //    dan disetor sehingga koreksi membuat kas tidak cocok.
      const [shift] = await tx
        .select({ status: shifts.status })
        .from(shifts)
        .where(eq(shifts.id, trx.shiftId))
        .limit(1)
      if (!shift || shift.status !== 'OPEN') {
        throw new TransactionEditError(
          'SHIFT_CLOSED',
          'Shift sudah ditutup, koreksi transaksi tidak diizinkan. Gunakan retur untuk penyesuaian.',
        )
      }

      // 3. Sudah pernah diretur → qty item jadi acuan sisa retur, mengubahnya bikin retur ganda
      const activeReturns = await tx
        .select({ id: returns.id })
        .from(returns)
        .where(and(eq(returns.transactionId, txId), isNull(returns.cancelledAt)))
        .limit(1)
      if (activeReturns.length > 0) {
        throw new TransactionEditError(
          'HAS_RETURN',
          'Transaksi ini sudah memiliki retur. Batalkan retur terlebih dahulu sebelum mengoreksi.',
        )
      }

      // 4. Hutang yang sudah menerima pembayaran = uang riil sudah masuk
      const debtRows = await tx
        .select({
          id: customerDebts.id,
          paidAmount: customerDebts.paidAmount,
          status: customerDebts.status,
        })
        .from(customerDebts)
        .where(eq(customerDebts.transactionId, txId))
        .for('update')
      const activeDebts = debtRows.filter((d: any) => d.status !== 'VOIDED')
      if (activeDebts.some((d: any) => d.paidAmount > 0)) {
        throw new TransactionEditError(
          'DEBT_HAS_PAYMENT',
          'Transaksi tidak bisa dikoreksi karena hutang pelanggannya sudah menerima pembayaran. Koreksi pembayaran hutang terlebih dahulu.',
        )
      }

      // 5. Item lama
      const existingItems: ExistingItem[] = await tx
        .select({
          id: transactionItems.id,
          productId: transactionItems.productId,
          productName: transactionItems.productName,
          productSku: transactionItems.productSku,
          uomId: transactionItems.uomId,
          qty: transactionItems.qty,
          unitPrice: transactionItems.unitPrice,
          totalPrice: transactionItems.totalPrice,
          discountAmount: transactionItems.discountAmount,
          priceTier: transactionItems.priceTier,
          cogs: transactionItems.cogs,
          originalQty: transactionItems.originalQty,
          originalCogs: transactionItems.originalCogs,
          isRemoved: transactionItems.isRemoved,
        })
        .from(transactionItems)
        .where(eq(transactionItems.transactionId, txId))

      const activeItems = existingItems.filter((i) => !i.isRemoved)
      const itemById = new Map(activeItems.map((i) => [i.id, i]))

      // 6. Pilah input jadi: baris yang di-update, baris yang dihapus, baris baru.
      //    Ganti produk/satuan masuk kategori hapus + tambah (lihat catatan di JSDoc).
      const updates: { existing: ExistingItem; input: EditItemInput }[] = []
      const additions: EditItemInput[] = []
      const keptIds = new Set<number>()

      for (const input of params.items) {
        if (input.transactionItemId == null) {
          additions.push(input)
          continue
        }
        const existing = itemById.get(input.transactionItemId)
        if (!existing) {
          throw new TransactionEditError(
            'ITEM_NOT_FOUND',
            `Item transaksi #${input.transactionItemId} tidak ditemukan pada transaksi ini`,
          )
        }
        if (existing.productId !== input.productId || existing.uomId !== input.uomId) {
          additions.push({ ...input, transactionItemId: null })
          continue
        }
        keptIds.add(existing.id)
        updates.push({ existing, input })
      }

      const removals = activeItems.filter((i) => !keptIds.has(i.id))

      // 7. Produk yang dipakai baris baru
      const newProductIds = Array.from(new Set(additions.map((a) => Number(a.productId))))
      const productRows =
        newProductIds.length > 0
          ? await tx
              .select({ id: products.id, name: products.name, sku: products.sku })
              .from(products)
              .where(inArray(products.id, newProductIds))
          : []
      const productById = new Map(productRows.map((p: any) => [p.id, p]))
      for (const id of newProductIds) {
        if (!productById.has(id)) {
          throw new TransactionEditError('PRODUCT_NOT_FOUND', `Produk ID ${id} tidak ditemukan`)
        }
      }

      // 8. Kunci baris stok semua produk yang tersentuh (anti race, sama seperti void)
      const touchedProductIds = Array.from(
        new Set(
          [
            ...removals.map((r) => r.productId),
            ...updates.map((u) => u.existing.productId),
            ...newProductIds,
          ].filter((id): id is number => id != null),
        ),
      )
      if (touchedProductIds.length > 0) {
        await tx
          .select({ id: productStocks.id })
          .from(productStocks)
          .where(
            and(
              inArray(productStocks.productId, touchedProductIds),
              eq(productStocks.branchId, branchId),
            ),
          )
          .for('update')
      }

      const snapshotBefore = {
        revision: trx.revision,
        totalAmount: trx.totalAmount,
        discountAmount: trx.discountAmount,
        payableAmount: trx.payableAmount,
        paidAmount: trx.paidAmount,
        changeAmount: trx.changeAmount,
        items: activeItems.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          uomId: i.uomId,
          qty: i.qty,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
          totalPrice: i.totalPrice,
          cogs: i.cogs,
        })),
      }

      // 9. Item dihapus → stok kembali penuh. Baris TIDAK dihapus: `original_qty`-nya
      //    yang menahan baris SALE_OUT asli di buku besar stok.
      for (const item of removals) {
        if (item.productId != null && item.qty > 0) {
          await returnStockForQty(
            tx,
            branchId,
            item.productId,
            item.uomId,
            item.qty,
            item.cogs ?? 0,
          )
        }
        await tx
          .update(transactionItems)
          .set({
            originalQty: item.originalQty ?? item.qty,
            originalCogs: item.originalCogs ?? item.cogs ?? 0,
            qty: 0,
            totalPrice: 0,
            discountAmount: 0,
            cogs: 0,
            isRemoved: true,
          })
          .where(eq(transactionItems.id, item.id))
      }

      // 10. Item yang qty/harganya berubah
      for (const { existing, input } of updates) {
        const newQty = Math.round(Number(input.qty))
        let newCogs = existing.cogs ?? 0

        if (existing.productId != null && newQty !== existing.qty) {
          if (newQty > existing.qty) {
            const result = await StockService.deductStock(
              tx,
              branchId,
              existing.productId,
              existing.uomId,
              newQty - existing.qty,
              true,
            )
            newCogs = (existing.cogs ?? 0) + Math.round(Number(result.totalCogs))
          } else if (existing.qty > 0) {
            const costPerUom = new Big(existing.cogs ?? 0).div(existing.qty)
            const returnQty = existing.qty - newQty
            await returnStockForQty(
              tx,
              branchId,
              existing.productId,
              existing.uomId,
              returnQty,
              Math.round(costPerUom.times(returnQty).toNumber()),
            )
            newCogs = Math.round(costPerUom.times(newQty).toNumber())
          }
        }

        await tx
          .update(transactionItems)
          .set({
            originalQty: existing.originalQty ?? existing.qty,
            originalCogs: existing.originalCogs ?? existing.cogs ?? 0,
            qty: newQty,
            unitPrice: Math.round(Number(input.unitPrice)),
            totalPrice: lineNet(newQty, input.unitPrice, input.discountAmount),
            discountAmount: Math.round(Number(input.discountAmount)),
            priceTier: input.priceTier,
            cogs: newCogs,
          })
          .where(eq(transactionItems.id, existing.id))
      }

      // 11. Item baru (termasuk hasil ganti produk/satuan) → potong stok FIFO.
      //     `originalQty: 0` menandai "tidak ada penjualan di jam nota terbit", sehingga
      //     buku besar hanya memunculkannya sebagai EDIT_OUT di jam koreksi.
      for (const input of additions) {
        const qty = Math.round(Number(input.qty))
        const product: any = productById.get(Number(input.productId))
        const result = await StockService.deductStock(
          tx,
          branchId,
          Number(input.productId),
          Number(input.uomId),
          qty,
          true,
        )
        await tx.insert(transactionItems).values({
          transactionId: txId,
          productId: Number(input.productId),
          productName: product.name,
          productSku: product.sku,
          uomId: Number(input.uomId),
          qty,
          unitPrice: Math.round(Number(input.unitPrice)),
          totalPrice: lineNet(qty, input.unitPrice, input.discountAmount),
          discountAmount: Math.round(Number(input.discountAmount)),
          priceTier: input.priceTier,
          cogs: Math.round(Number(result.totalCogs)),
          originalQty: 0,
          originalCogs: 0,
          isRemoved: false,
        })
      }

      // 12. Hitung ulang total header. Diskon tingkat nota (bagian diskon header yang
      //     tidak berasal dari item) dipertahankan apa adanya — di luar cakupan koreksi.
      const oldItemDiscountTotal = activeItems.reduce((sum, i) => sum + i.discountAmount, 0)
      const headerOnlyDiscount = Math.max(0, trx.discountAmount - oldItemDiscountTotal)

      const newTotalAmount = params.items.reduce(
        (sum, i) => sum + lineGross(Math.round(Number(i.qty)), Number(i.unitPrice)),
        0,
      )
      const newItemDiscountTotal = params.items.reduce(
        (sum, i) => sum + Math.round(Number(i.discountAmount)),
        0,
      )
      const newDiscountAmount = newItemDiscountTotal + headerOnlyDiscount
      const newPayableAmount = Math.max(0, newTotalAmount - newDiscountAmount)

      // 13. Pembayaran ditulis ulang sesuai penyelesaian baru di kasir
      const totalPaid = params.payments.reduce((sum, p) => sum + Math.round(Number(p.amount)), 0)
      if (totalPaid < newPayableAmount) {
        throw new TransactionEditError(
          'PAYMENT_INSUFFICIENT',
          'Total pembayaran kurang dari nominal transaksi hasil koreksi',
        )
      }

      const paymentMethodIds = Array.from(
        new Set(params.payments.map((p) => Number(p.paymentMethodId))),
      )
      const methodRows =
        paymentMethodIds.length > 0
          ? await tx
              .select({ id: paymentMethods.id, type: paymentMethods.type })
              .from(paymentMethods)
              .where(inArray(paymentMethods.id, paymentMethodIds))
          : []
      const typeById = new Map(methodRows.map((m: any) => [m.id, m.type]))

      const newDebtAmount = params.payments.reduce(
        (sum, p) =>
          sum +
          (typeById.get(Number(p.paymentMethodId)) === 'DEBT' ? Math.round(Number(p.amount)) : 0),
        0,
      )

      await tx.delete(transactionPayments).where(eq(transactionPayments.transactionId, txId))
      if (params.payments.length > 0) {
        await tx.insert(transactionPayments).values(
          params.payments.map((p) => ({
            transactionId: txId,
            paymentMethodId: Number(p.paymentMethodId),
            amount: Math.round(Number(p.amount)),
            referenceNumber: p.referenceNumber || null,
          })),
        )
      }

      // 14. Sesuaikan hutang pelanggan
      const customerId = params.customerId ?? trx.customerId ?? null
      const existingDebt = activeDebts[0]
      if (newDebtAmount > 0) {
        if (!customerId) {
          throw new TransactionEditError(
            'CUSTOMER_REQUIRED_FOR_DEBT',
            'Pelanggan wajib dipilih untuk transaksi dengan pembayaran hutang',
          )
        }
        if (existingDebt) {
          await tx
            .update(customerDebts)
            .set({
              totalAmount: newDebtAmount,
              remainingAmount: newDebtAmount,
              status: 'UNPAID',
            })
            .where(eq(customerDebts.id, existingDebt.id))
        } else {
          const parsedDue = params.dueAt ? new Date(params.dueAt) : null
          await tx.insert(customerDebts).values({
            customerId,
            transactionId: txId,
            branchId,
            totalAmount: newDebtAmount,
            paidAmount: 0,
            remainingAmount: newDebtAmount,
            status: 'UNPAID',
            dueAt: parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue : null,
            createdBy: actorUserId,
          })
        }
      } else if (existingDebt) {
        await tx
          .update(customerDebts)
          .set({ status: 'VOIDED', remainingAmount: 0 })
          .where(eq(customerDebts.id, existingDebt.id))
      }

      // 15. Header
      const newRevision = trx.revision + 1
      const newChangeAmount = Math.max(0, totalPaid - newPayableAmount)

      await tx
        .update(transactions)
        .set({
          totalAmount: newTotalAmount,
          discountAmount: newDiscountAmount,
          payableAmount: newPayableAmount,
          paidAmount: totalPaid,
          changeAmount: newChangeAmount,
          customerId,
          revision: newRevision,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, txId))

      // 16. Riwayat koreksi + audit log
      const itemsAfter = await tx
        .select({
          id: transactionItems.id,
          productId: transactionItems.productId,
          productName: transactionItems.productName,
          uomId: transactionItems.uomId,
          qty: transactionItems.qty,
          unitPrice: transactionItems.unitPrice,
          discountAmount: transactionItems.discountAmount,
          totalPrice: transactionItems.totalPrice,
          cogs: transactionItems.cogs,
          isRemoved: transactionItems.isRemoved,
        })
        .from(transactionItems)
        .where(eq(transactionItems.transactionId, txId))

      const snapshotAfter = {
        revision: newRevision,
        totalAmount: newTotalAmount,
        discountAmount: newDiscountAmount,
        payableAmount: newPayableAmount,
        paidAmount: totalPaid,
        changeAmount: newChangeAmount,
        items: itemsAfter.filter((i: any) => !i.isRemoved),
      }

      await tx.insert(transactionEdits).values({
        transactionId: txId,
        revision: newRevision,
        branchId,
        shiftId: trx.shiftId,
        editedById: actorUserId,
        approvedById: approvedById ?? null,
        reason,
        beforeData: snapshotBefore,
        afterData: snapshotAfter,
      })

      await tx.insert(auditLogs).values({
        branchId,
        userId: actorUserId,
        action: 'EDIT_TRANSACTION',
        tableName: 'transactions',
        recordId: String(txId),
        newData: JSON.stringify({
          trxNumber: trx.trxNumber,
          revision: newRevision,
          reason,
          approvedById: approvedById ?? null,
          payableBefore: trx.payableAmount,
          payableAfter: newPayableAmount,
        }),
      })

      return {
        trxNumber: trx.trxNumber,
        revision: newRevision,
        payableAmount: newPayableAmount,
        paidAmount: totalPaid,
        changeAmount: newChangeAmount,
      }
    })
  }
}
