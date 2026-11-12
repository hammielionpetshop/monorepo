import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, roles, users, moneyPlaces, cashFlowCategories, cashFlowEntries, recurringCosts, recurringCostPayments, eq, and, asc, inArray,
} from '../db'
import {
  createRecurringCost, updateRecurringCost, changeRecurringCostAmount, payRecurringCost, cancelRecurringCostPayment, listRecurringCosts,
  RecurringCostError,
} from './recurring-cost-service'
import { addMonths } from './recurring-cost-rules'
import { todayWibDate } from '../payment-date'

// F2-5a Biaya Rutin (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §2.6) di DB lokal.
const run = randomUUID().slice(0, 8)
const today = todayWibDate()
const thisMonth = today.slice(0, 7)
const lastMonth = addMonths(thisMonth, -1)
let branchId: number
let financeId: number
let ownerId: number
let bankId: number
let drawerId: number
let rentCategoryId: number

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `BR${run}`, name: `Toko Rutin ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `BR${run}` }).returning())[0].id
  financeId = (await db.insert(users).values({ name: `Finance ${run}`, roleId, branchId }).returning())[0].id
  ownerId = (await db.insert(users).values({ name: `Owner ${run}`, roleId, branchId }).returning())[0].id
  bankId = (await db.insert(moneyPlaces).values({ name: `Rekening ${run}`, kind: 'BANK', branchId, bankName: 'BCA', accountNumber: '1', accountHolder: 'x' }).returning())[0].id
  const [drawer] = await db.select({ id: moneyPlaces.id }).from(moneyPlaces).where(and(eq(moneyPlaces.branchId, branchId), eq(moneyPlaces.kind, 'DRAWER')))
  drawerId = drawer?.id ?? 0
  const [rent] = await db.select({ id: cashFlowCategories.id }).from(cashFlowCategories)
    .where(and(eq(cashFlowCategories.name, 'Sewa toko'), eq(cashFlowCategories.type, 'EXPENSE')))
  rentCategoryId = rent.id
})

const finance = () => ({ userId: financeId, isOwner: false, canCancelAny: false })
const owner = () => ({ userId: ownerId, isOwner: true, canCancelAny: true })

async function newCost(over: Partial<Parameters<typeof createRecurringCost>[0]> = {}) {
  return createRecurringCost({
    name: `Sewa Toko ${run}`, categoryId: rentCategoryId, branchId, dueDay: 5, startMonth: lastMonth, endMonth: null, note: null, amount: 2_000_000, ...over,
  }, owner())
}

const pay = (costId: number, over: Partial<Parameters<typeof payRecurringCost>[0]> = {}) => payRecurringCost({
  recurringCostId: costId, fromMonth: lastMonth, toMonth: lastMonth, occurredOn: today, moneyPlaceId: bankId, amount: 2_000_000,
  differenceReason: null, proofPhotoUrl: null, ...over,
}, finance())

async function billsOf(costId: number) {
  return (await listRecurringCosts(finance())).bills.filter((b) => b.costId === costId).sort((a, b) => a.month.localeCompare(b.month))
}

describe('Biaya Rutin F2-5a (DB lokal)', () => {
  it('kategori sewa sistem ada dan "Sewa (sementara)" nonaktif', async () => {
    const rows = await db.select().from(cashFlowCategories).where(inArray(cashFlowCategories.name, ['Sewa toko', 'Sewa kendaraan', 'Sewa lain', 'Sewa (sementara)']))
    expect(rows.filter((r) => r.isSystem && r.reportKind === 'COST')).toHaveLength(3)
    const temp = rows.find((r) => r.name === 'Sewa (sementara)')
    if (temp) expect(temp.isActive).toBe(false)
  })

  it('tagihan bulan lalu (merah) dan bulan ini muncul dari pengaturan', async () => {
    const cost = await newCost()
    const bills = await billsOf(cost.id)
    expect(bills.map((b) => b.month)).toEqual([lastMonth, thisMonth])
    expect(bills[0]).toMatchObject({ amount: 2_000_000, status: 'OVERDUE', payment: null })
  })

  it('Sudah dibayar menulis catatan Arus Kas untuk bulan tagihan; bayar dua kali ditolak; laci ditolak', async () => {
    const cost = await newCost()
    if (drawerId) await expect(pay(cost.id, { moneyPlaceId: drawerId })).rejects.toThrow(/Laci/)
    await expect(pay(cost.id, { amount: 1_500_000 })).rejects.toThrow(/alasan wajib/)
    await pay(cost.id)
    await expect(pay(cost.id)).rejects.toThrow(/sudah dibayar/)

    const [payment] = await db.select().from(recurringCostPayments).where(eq(recurringCostPayments.recurringCostId, cost.id))
    const [entry] = await db.select().from(cashFlowEntries).where(eq(cashFlowEntries.id, payment.cashFlowEntryId))
    expect(entry).toMatchObject({
      type: 'EXPENSE', categoryId: rentCategoryId, branchId, amount: 2_000_000, occurredOn: today, forMonth: `${lastMonth}-01`, moneyPlaceId: bankId,
    })
    expect((await billsOf(cost.id))[0].status).toBe('PAID')
  })

  it('bayar 12 bulan sekaligus: 12 catatan per bulan, tanggal uang sama; batal bersama membuka lagi semua bulan', async () => {
    const cost = await newCost({ startMonth: thisMonth })
    const toMonth = addMonths(thisMonth, 11)
    const { batchKey, months } = await pay(cost.id, { fromMonth: thisMonth, toMonth, amount: 24_000_000 })
    expect(months).toHaveLength(12)
    const payments = await db.select().from(recurringCostPayments).where(eq(recurringCostPayments.batchKey, batchKey)).orderBy(asc(recurringCostPayments.forMonth))
    const entries = await db.select().from(cashFlowEntries).where(inArray(cashFlowEntries.id, payments.map((p) => p.cashFlowEntryId)))
    expect(entries).toHaveLength(12)
    expect(new Set(entries.map((e) => e.occurredOn))).toEqual(new Set([today]))
    expect(entries.map((e) => e.forMonth).sort()).toEqual(months.map((m) => `${m}-01`))
    expect((await billsOf(cost.id))).toHaveLength(12) // bulan depan ikut tampil karena sudah dibayar di muka

    await expect(cancelRecurringCostPayment(batchKey, 'x', finance())).rejects.toThrow(/Alasan/)
    await cancelRecurringCostPayment(batchKey, 'salah biaya', finance())
    const after = await db.select().from(cashFlowEntries).where(inArray(cashFlowEntries.id, payments.map((p) => p.cashFlowEntryId)))
    expect(after.every((e) => e.cancelledAt !== null)).toBe(true)
    const bills = await billsOf(cost.id)
    expect(bills.map((b) => b.month)).toEqual([thisMonth])
    expect(bills[0].payment).toBeNull()
    await expect(cancelRecurringCostPayment(batchKey, 'lagi', owner())).rejects.toThrow(/sudah dibatalkan/)
  })

  it('jumlah beda dibagi per bulan dengan alasan; total sama dengan yang dibayar', async () => {
    const cost = await newCost()
    const { batchKey } = await pay(cost.id, { toMonth: thisMonth, amount: 3_000_001, differenceReason: 'potongan pemilik' })
    const payments = await db.select().from(recurringCostPayments).where(eq(recurringCostPayments.batchKey, batchKey))
    expect(payments.reduce((s, p) => s + p.amount, 0)).toBe(3_000_001)
    expect(payments.every((p) => p.billedAmount === 2_000_000 && p.differenceReason === 'potongan pemilik')).toBe(true)
  })

  it('orang lain tanpa cashflow.cancel tidak bisa membatalkan; Owner/GM bisa', async () => {
    const cost = await newCost()
    const { batchKey } = await pay(cost.id)
    await expect(cancelRecurringCostPayment(batchKey, 'bukan punya saya', { userId: ownerId, isOwner: false, canCancelAny: false })).rejects.toThrow(/Owner\/GM/)
    await cancelRecurringCostPayment(batchKey, 'dobel bayar', owner())
  })

  it('ubah jumlah mulai bulan depan; bulan yang sudah dibayar terkunci; kategori/cabang terkunci sesudah dibayar', async () => {
    const cost = await newCost()
    await pay(cost.id)
    await expect(changeRecurringCostAmount(cost.id, { effectiveMonth: lastMonth, amount: 2_500_000 }, owner())).rejects.toThrow(/sudah dibayar/)
    await changeRecurringCostAmount(cost.id, { effectiveMonth: addMonths(thisMonth, 1), amount: 2_500_000 }, owner())
    const row = (await listRecurringCosts(finance())).costs.find((c) => c.id === cost.id)!
    expect(row.currentAmount).toBe(2_000_000)
    expect(row.amounts.map((a) => a.amount)).toEqual([2_000_000, 2_500_000])

    const base = { name: cost.name, categoryId: rentCategoryId, branchId, dueDay: 5, startMonth: lastMonth, endMonth: null, note: null, isActive: true }
    await expect(updateRecurringCost(cost.id, { ...base, branchId: null }, owner())).rejects.toBeInstanceOf(RecurringCostError)
    await expect(updateRecurringCost(cost.id, { ...base, isActive: false }, owner())).rejects.toThrow(/nonaktifkan/)
    const ended = await updateRecurringCost(cost.id, { ...base, endMonth: thisMonth, dueDay: 10 }, owner())
    expect(ended).toMatchObject({ endMonth: `${thisMonth}-01`, dueDay: 10 })
  })

  it('biaya salah buat sebelum dibayar boleh nonaktif (tagihannya hilang); database menolak hapus & ubah pembayaran', async () => {
    const cost = await newCost()
    await updateRecurringCost(cost.id, { name: cost.name, categoryId: rentCategoryId, branchId, dueDay: 5, startMonth: lastMonth, endMonth: null, note: null, isActive: false }, owner())
    expect(await billsOf(cost.id)).toHaveLength(0)
    await expect(db.delete(recurringCosts).where(eq(recurringCosts.id, cost.id))).rejects.toThrow()

    const other = await newCost()
    await pay(other.id)
    const [payment] = await db.select().from(recurringCostPayments).where(eq(recurringCostPayments.recurringCostId, other.id))
    await expect(db.update(recurringCostPayments).set({ amount: 1 }).where(eq(recurringCostPayments.id, payment.id))).rejects.toThrow()
    await expect(db.delete(recurringCostPayments).where(eq(recurringCostPayments.id, payment.id))).rejects.toThrow()
  })
})
