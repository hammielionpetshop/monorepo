import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  db, branches, roles, users, unitsOfMeasure, products, transactions, transactionItems,
  interBranchTransfers, interBranchTransferItems, interBranchPayables, interBranchPayments,
  internalReturns, internalReturnItems, internalCreditEntries, eq, and, sql, isNull,
} from '../db'

// RI4 — fondasi DB Retur Internal (migrasi 0034). Semua isian dibuat di dalam satu transaksi
// lalu di-rollback, jadi DB uji tidak bertambah sampah.
const ROLLBACK = new Error('ROLLBACK_TES')

describe('Retur Internal — tabel fondasi (DB lokal)', () => {
  it('dokumen, baris barang, Saldo Internal, dan penanda pembayaran bisa diisi & dibaca', async () => {
    const run = randomUUID().slice(0, 8)
    await expect(db.transaction(async (tx) => {
      const sender = (await tx.insert(branches).values({ code: `RG${run}`, name: `Gudang RI ${run}` }).returning())[0].id
      const receiver = (await tx.insert(branches).values({ code: `RT${run}`, name: `Toko RI ${run}` }).returning())[0].id
      const roleId = (await tx.insert(roles).values({ name: `RI${run}` }).returning())[0].id
      const userId = (await tx.insert(users).values({ name: `RI${run}`, roleId, branchId: receiver }).returning())[0].id
      const pcs = (await tx.insert(unitsOfMeasure).values({ code: `R${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
      const productId = (await tx.insert(products).values({ name: `Produk RI ${run}`, baseUomId: pcs, defaultCostPrice: 1_000 }).returning())[0].id

      const [sale] = await tx.insert(transactions).values({
        trxNumber: `RI${run}`, branchId: sender, shiftId: 0, cashierId: userId,
        totalAmount: 10_000, payableAmount: 10_000, paidAmount: 10_000, changeAmount: 0, saleType: 'BULK',
      }).returning()
      const [saleItem] = await tx.insert(transactionItems).values({
        transactionId: sale.id, productId, uomId: pcs, qty: 10, unitPrice: 1_000, totalPrice: 10_000, priceTier: 'GROSIR',
      }).returning()
      const [ibt] = await tx.insert(interBranchTransfers).values({
        ibtNumber: `IBT-RI-${run}`, sourceBranchId: sender, destinationBranchId: receiver, requestedById: userId,
        status: 'FULLY_RECEIVED', convertedTransactionId: sale.id,
      }).returning()
      const [ibtItem] = await tx.insert(interBranchTransferItems).values({
        transferId: ibt.id, productId, uomId: pcs, qtyRequested: 10, qtyShipped: 10, qtyReceived: 10, costPriceAtTransfer: 1_000,
      }).returning()
      const [payable] = await tx.insert(interBranchPayables).values({
        transferId: ibt.id, debtorBranchId: receiver, creditorBranchId: sender, totalAmount: 10_000, paidAmount: 10_000, status: 'PAID',
      }).returning()

      // Pembayaran biasa tetap tanpa penanda; baris otomatis membawa source_type.
      const [manual] = await tx.insert(interBranchPayments).values({ payableId: payable.id, amount: 10_000, paidByUserId: userId }).returning()
      expect(manual.sourceType).toBeNull()

      const [doc] = await tx.insert(internalReturns).values({
        returnNumber: `RI-TES-${run}`, kind: 'BARANG_DIKEMBALIKAN', transferId: ibt.id, saleTransactionId: sale.id,
        payableId: payable.id, requestBranchId: receiver, receiverBranchId: receiver, senderBranchId: sender,
        reason: 'TIDAK_DATANG', notes: 'tes fondasi', source: 'POS', totalValue: 2_000, requestedById: userId,
      }).returning()
      expect(doc.status).toBe('PENDING')
      expect([doc.payableDeduction, doc.creditAmount, doc.cogsAdjustment]).toEqual([0, 0, 0])
      expect(doc.cancelledAt).toBeNull()

      await tx.insert(internalReturnItems).values({
        internalReturnId: doc.id, transferItemId: ibtItem.id, saleItemId: saleItem.id, productId, uomId: pcs,
        qty: 2, oldUnitPrice: 1_000, lineValue: 2_000,
      })

      // Hutang sudah lunas → nilai retur jadi Saldo Internal, lalu dipakai memotong tagihan.
      const [usage] = await tx.insert(interBranchPayments).values({
        payableId: payable.id, amount: 1_500, paidByUserId: userId, sourceType: 'SALDO_INTERNAL',
      }).returning()
      await tx.insert(internalCreditEntries).values([
        { debtorBranchId: receiver, creditorBranchId: sender, amount: 2_000, sourceType: 'RETUR_INTERNAL', internalReturnId: doc.id, createdById: userId },
        { debtorBranchId: receiver, creditorBranchId: sender, amount: -1_500, sourceType: 'PAKAI', payableId: payable.id, paymentId: usage.id, createdById: userId },
      ])

      const [{ saldo }] = await tx.select({ saldo: sql<number>`coalesce(sum(${internalCreditEntries.amount}), 0)::int` })
        .from(internalCreditEntries)
        .where(and(eq(internalCreditEntries.debtorBranchId, receiver), eq(internalCreditEntries.creditorBranchId, sender)))
      expect(saldo).toBe(500)

      const items = await tx.select().from(internalReturnItems).where(eq(internalReturnItems.internalReturnId, doc.id))
      expect(items).toHaveLength(1)
      expect(items[0].proposedUnitPrice).toBeNull()

      const manualRows = await tx.select({ id: interBranchPayments.id }).from(interBranchPayments)
        .where(and(eq(interBranchPayments.payableId, payable.id), isNull(interBranchPayments.sourceType)))
      expect(manualRows.map(r => r.id)).toEqual([manual.id])

      throw ROLLBACK
    })).rejects.toBe(ROLLBACK)
  })
})
