import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, roles, users, paymentMethods, interBranchTransfers, interBranchPayables, interBranchPayments,
  cashFlowCategories, cashFlowEntries, legacySettlementRuns, eq, and, asc, inArray,
} from '../db'
import { buildInterBranchPaymentCashEntries } from '../inter-branch-payment-cash'
import { cancelInterBranchPayment, PaymentCancelError } from './inter-branch-payment-cancel'

// Batalkan pembayaran manual Utang Internal (spec 2026-11-11-ibp-payment-cancel-design.md §7).
const run = randomUUID().slice(0, 8)
let userId: number
let debtor: number
let creditor: number
let methodId: number
let seq = 0

async function makePayable(total: number, createdAt = new Date()) {
  seq += 1
  const [t] = await db.insert(interBranchTransfers).values({
    ibtNumber: `IBT-C${run}-${seq}`, sourceBranchId: creditor, destinationBranchId: debtor, requestedById: userId, status: 'RECEIVED',
  }).returning()
  const [p] = await db.insert(interBranchPayables).values({
    transferId: t.id, debtorBranchId: debtor, creditorBranchId: creditor, totalAmount: total, createdAt,
  }).returning()
  return { id: p.id, ibtNumber: t.ibtNumber }
}

async function categoryId(name: string, type: 'EXPENSE' | 'INCOME') {
  const [c] = await db.select({ id: cashFlowCategories.id }).from(cashFlowCategories)
    .where(and(eq(cashFlowCategories.name, name), eq(cashFlowCategories.type, type)))
  return c?.id ?? (await db.insert(cashFlowCategories).values({ name, type, isSystem: true, reportKind: 'NON_COST' }).returning())[0].id
}

/** Meniru route Bayar: tambah paid_amount + baris pembayaran + dua catatan Arus Kas (waktu catat = waktu bayar). */
async function payManual(payable: { id: number; ibtNumber: string }, amount: number, withMethod = true, paidAt = new Date()) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(interBranchPayables).where(eq(interBranchPayables.id, payable.id))
    const paid = p.paidAmount + amount
    await tx.update(interBranchPayables)
      .set({ paidAmount: paid, status: paid >= p.totalAmount ? 'PAID' : 'PARTIAL' })
      .where(eq(interBranchPayables.id, payable.id))
    const [pay] = await tx.insert(interBranchPayments).values({
      payableId: payable.id, amount, paidByUserId: userId, paymentMethodId: withMethod ? methodId : null, paidAt,
    }).returning()
    if (withMethod) {
      for (const e of buildInterBranchPaymentCashEntries({
        amount, ibtNumber: payable.ibtNumber, debtorBranchId: debtor, debtorBranchName: 'A', creditorBranchId: creditor,
        creditorBranchName: 'B', paymentMethodName: 'Transfer',
      })) {
        await tx.insert(cashFlowEntries).values({
          type: e.type, categoryId: await categoryId(e.category, e.type), branchId: e.branchId, amount: e.amount,
          note: e.note, createdBy: userId, createdAt: paidAt,
        })
      }
    }
    return pay.id
  })
}

const payableOf = async (id: number) => (await db.select().from(interBranchPayables).where(eq(interBranchPayables.id, id)))[0]
const cashOf = async (ibtNumber: string) => (await db.select().from(cashFlowEntries).orderBy(asc(cashFlowEntries.id)))
  .filter((e) => e.note?.includes(ibtNumber))

beforeAll(async () => {
  debtor = (await db.insert(branches).values({ code: `CD${run}`, name: `Toko Batal ${run}` }).returning())[0].id
  creditor = (await db.insert(branches).values({ code: `CC${run}`, name: `Gudang Batal ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `CB${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Owner Batal ${run}`, roleId, branchId: creditor }).returning())[0].id
  methodId = (await db.insert(paymentMethods).values({ name: `Transfer Batal ${run}`, type: 'BANK_TRANSFER' }).returning())[0].id
})

describe('Batalkan pembayaran manual Utang Internal (DB lokal)', () => {
  it('lunas → batal: status Sebagian/Belum Bayar, baris BATAL_BAYAR negatif, Arus Kas kedua cabang Batal, tidak bisa dua kali', async () => {
    const payable = await makePayable(500_000)
    const first = await payManual(payable, 200_000)
    const second = await payManual(payable, 300_000)
    expect((await payableOf(payable.id)).status).toBe('PAID')

    const result = await cancelInterBranchPayment({ payableId: payable.id, paymentId: second, reason: 'salah nominal', userId })
    expect(result).toMatchObject({ status: 'PARTIAL', paidAmount: 200_000, cashEntriesCancelled: 2 })
    expect(await payableOf(payable.id)).toMatchObject({ status: 'PARTIAL', paidAmount: 200_000 })

    const [reversal] = await db.select().from(interBranchPayments).where(eq(interBranchPayments.reversalOfPaymentId, second))
    expect(reversal).toMatchObject({ amount: -300_000, sourceType: 'BATAL_BAYAR', paymentMethodId: null })

    const cash = await cashOf(payable.ibtNumber)
    expect(cash).toHaveLength(4)
    expect(cash.filter((e) => e.amount === 300_000).every((e) => e.cancelledAt !== null && e.cancelReason?.includes('salah nominal'))).toBe(true)
    expect(cash.filter((e) => e.amount === 200_000).every((e) => e.cancelledAt === null)).toBe(true)

    await expect(cancelInterBranchPayment({ payableId: payable.id, paymentId: second, reason: 'kedua kali', userId }))
      .rejects.toThrow('sudah dibatalkan')

    await cancelInterBranchPayment({ payableId: payable.id, paymentId: first, reason: 'salah cabang', userId })
    expect(await payableOf(payable.id)).toMatchObject({ status: 'UNPAID', paidAmount: 0 })
  })

  it('pembayaran lama tanpa metode: dibatalkan tanpa catatan Arus Kas', async () => {
    const payable = await makePayable(100_000)
    const pay = await payManual(payable, 100_000, false)
    const result = await cancelInterBranchPayment({ payableId: payable.id, paymentId: pay, reason: 'data lama keliru', userId })
    expect(result).toMatchObject({ status: 'UNPAID', paidAmount: 0, cashEntriesCancelled: 0 })
  })

  it('menolak baris otomatis, utang Dihapus, alasan pendek, dan pembayaran dari utang lain', async () => {
    const payable = await makePayable(100_000)
    const [auto] = await db.insert(interBranchPayments).values({
      payableId: payable.id, amount: 50_000, sourceType: 'SETORAN', paidByUserId: userId,
    }).returning()
    await expect(cancelInterBranchPayment({ payableId: payable.id, paymentId: auto.id, reason: 'coba batal', userId }))
      .rejects.toBeInstanceOf(PaymentCancelError)

    const other = await makePayable(100_000)
    const manual = await payManual(payable, 10_000)
    await expect(cancelInterBranchPayment({ payableId: other.id, paymentId: manual, reason: 'salah utang', userId }))
      .rejects.toThrow('tidak ditemukan')
    await expect(cancelInterBranchPayment({ payableId: payable.id, paymentId: manual, reason: 'abc', userId }))
      .rejects.toThrow('minimal 5 huruf')

    await db.update(interBranchPayables).set({ status: 'WAIVED' }).where(eq(interBranchPayables.id, payable.id))
    await expect(cancelInterBranchPayment({ payableId: payable.id, paymentId: manual, reason: 'sudah dihapus', userId }))
      .rejects.toThrow('dihapuskan')
  })

  it('ditolak bila pembayaran ikut dihitung pelunasan susulan yang masih berlaku', async () => {
    const payable = await makePayable(100_000, new Date('2026-10-10T10:00:00+07:00'))
    const pay = await payManual(payable, 40_000, true, new Date('2026-10-22T12:00:00+07:00'))
    const active = await db.select({ id: legacySettlementRuns.id }).from(legacySettlementRuns)
      .where(eq(legacySettlementRuns.status, 'ACTIVE'))
    // Tes ini butuh satu pelaksanaan aktif buatannya sendiri; jangan ganggu sisa data tes lain.
    if (active.length > 0) return
    const [legacy] = await db.insert(legacySettlementRuns).values({
      fromDate: '2026-10-20', cutoffDate: '2026-11-01', includeNoncash: false, subtractManual: true,
      settledAmount: 0, payablesCount: 0, freeAmount: 0, notes: 'tes', createdBy: userId,
    }).returning()
    try {
      await expect(cancelInterBranchPayment({ payableId: payable.id, paymentId: pay, reason: 'mau dibatalkan', userId }))
        .rejects.toThrow(`SUSULAN-${legacy.id}`)
    } finally {
      await db.update(legacySettlementRuns)
        .set({ status: 'CANCELLED', cancelledBy: userId, cancelledAt: new Date(), cancelReason: 'bersihkan tes' })
        .where(inArray(legacySettlementRuns.id, [legacy.id]))
    }
    const result = await cancelInterBranchPayment({ payableId: payable.id, paymentId: pay, reason: 'susulan sudah batal', userId })
    expect(result.status).toBe('UNPAID')
  })
})
