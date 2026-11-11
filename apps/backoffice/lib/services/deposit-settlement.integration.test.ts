import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, roles, users, moneyPlaces, shifts, shiftCashierBreakdown, interBranchTransfers, interBranchPayables,
  interBranchPayments, depositSettlements, appSettings, eq, and, asc,
} from '../db'
import { receiveCashDeposit, correctCashDeposit, getDepositSettings, type DepositActor } from './deposit-service'
import { getAutoSettlementSettings } from './deposit-settlement-service'
import { todayWibDate } from '../payment-date'

// F2-3 Pelunasan Otomatis (spec §7): rantai Toko A → Toko Pusat → Gudang, setoran bebas, tujuan
// bukan Finance, koreksi membalik tanpa menghapus, utang sebelum tanggal mulai tidak tersentuh.
const run = randomUUID().slice(0, 8)
let finance: DepositActor
let owner: DepositActor
let kasirId: number
let tokoA: number
let pusat: number
let gudang: number
let brankas: number
let storeHeld: number
let seq = 0

async function makeShift(branchId: number, cash: number) {
  seq += 1
  const [s] = await db.insert(shifts).values({
    branchId, openedById: kasirId, shiftNumber: 800 + seq, assignedCashiers: [kasirId], openingCash: 0,
    status: 'CLOSED', origin: 'POS', closedAt: new Date(), totalClosingCashReal: cash, totalClosingCashExpected: cash,
  }).returning()
  await db.insert(shiftCashierBreakdown).values({ shiftId: s.id, cashierId: kasirId, totalSalesCash: cash })
  return s.id
}

async function makePayable(debtor: number, creditor: number, amount: number, createdAt: Date) {
  seq += 1
  const [t] = await db.insert(interBranchTransfers).values({
    ibtNumber: `IBT-T${run}-${seq}`, sourceBranchId: creditor, destinationBranchId: debtor, requestedById: kasirId, status: 'RECEIVED',
  }).returning()
  const [p] = await db.insert(interBranchPayables).values({
    transferId: t.id, debtorBranchId: debtor, creditorBranchId: creditor, totalAmount: amount, createdAt,
  }).returning()
  return p.id
}

async function payable(id: number) {
  const [p] = await db.select().from(interBranchPayables).where(eq(interBranchPayables.id, id))
  return p
}

function receive(branchId: number, cash: number, received: number, destination = brankas) {
  return makeShift(branchId, cash).then((shiftId) => receiveCashDeposit({
    branchId, shiftIds: [shiftId], destinationMoneyPlaceId: destination, depositDate: todayWibDate(),
    receivedAmount: received, variances: received === cash ? [] : [{ amount: received - cash, cause: 'OTHER', note: 'tes' }],
  }, finance))
}

beforeAll(async () => {
  tokoA = (await db.insert(branches).values({ code: `SA${run}`, name: `Toko A ${run}` }).returning())[0].id
  pusat = (await db.insert(branches).values({ code: `SP${run}`, name: `Pusat ${run}` }).returning())[0].id
  gudang = (await db.insert(branches).values({ code: `SG${run}`, name: `Gudang ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `ST${run}` }).returning())[0].id
  const fin = (await db.insert(users).values({ name: `Fin ${run}`, roleId, branchId: gudang }).returning())[0].id
  kasirId = (await db.insert(users).values({ name: `Kasir ${run}`, roleId, branchId: tokoA }).returning())[0].id
  finance = { userId: fin, branchId: gudang, role: 'FINANCE' }
  owner = { userId: fin, branchId: gudang, role: 'OWNER' }
  brankas = (await db.insert(moneyPlaces).values({ name: `Brankas S ${run}`, kind: 'CASH', branchId: gudang }).returning())[0].id
  storeHeld = (await db.insert(moneyPlaces).values({ name: `Kas toko ${run}`, kind: 'CASH', branchId: tokoA, heldBy: 'STORE' }).returning())[0].id
  const settings = await getDepositSettings()
  if (settings.startDate > todayWibDate()) {
    await db.update(appSettings).set({ value: JSON.stringify({ ...settings, startDate: todayWibDate() }) }).where(eq(appSettings.key, 'deposit_settings'))
  }
})

describe('Pelunasan otomatis dari Setoran (DB lokal)', () => {
  it('contoh spec: paling lama dulu, berantai ke Gudang, sisa = setoran bebas; utang sebelum tanggal mulai tidak tersentuh', async () => {
    expect((await getAutoSettlementSettings()).startDate > '2026-10-15').toBe(true)
    const now = Date.now()
    const old = await makePayable(tokoA, gudang, 700_000, new Date('2026-10-15T10:00:00+07:00'))
    const aPusat = await makePayable(tokoA, pusat, 3_000_000, new Date(now - 3_000))
    const pusatGudang = await makePayable(pusat, gudang, 2_000_000, new Date(now - 2_000))
    const aGudang = await makePayable(tokoA, gudang, 1_000_000, new Date(now - 1_000))

    const dep = await receive(tokoA, 5_000_000, 5_000_000)
    expect(dep.settlement).toEqual({ payablesSettled: 3, settledAmount: 6_000_000, freeAmount: 1_000_000 })

    expect((await payable(aPusat)).status).toBe('PAID')
    expect((await payable(aGudang)).status).toBe('PAID')
    expect((await payable(pusatGudang)).status).toBe('PAID')
    expect(await payable(old)).toMatchObject({ status: 'UNPAID', paidAmount: 0 })

    const pays = await db.select().from(interBranchPayments).where(eq(interBranchPayments.payableId, pusatGudang))
    expect(pays).toMatchObject([{ amount: 2_000_000, sourceType: 'SETORAN', referenceNumber: dep.depositNumber, paymentMethodId: null }])

    const rows = await db.select().from(depositSettlements)
      .where(and(eq(depositSettlements.sourceType, 'CASH_DEPOSIT'), eq(depositSettlements.sourceId, dep.id)))
      .orderBy(asc(depositSettlements.id))
    const free = rows.filter((r) => r.payableId == null)
    expect(free.reduce((t, r) => t + r.amount, 0)).toBe(5_000_000)
    expect(free.find((r) => r.payerBranchId === pusat)?.amount).toBe(1_000_000)
  })

  it('setoran ke tempat dipegang toko tidak melunasi', async () => {
    const p = await makePayable(tokoA, gudang, 100_000, new Date())
    const dep = await receive(tokoA, 100_000, 100_000, storeHeld)
    expect(dep.settlement).toEqual({ payablesSettled: 0, settledAmount: 0, freeAmount: 0 })
    expect((await payable(p)).status).toBe('UNPAID')
  })

  it('koreksi membalik seluruh rantai dengan baris negatif lalu melunasi ulang sebesar nominal baru', async () => {
    const p = await payable((await db.select().from(interBranchPayables)
      .where(and(eq(interBranchPayables.debtorBranchId, tokoA), eq(interBranchPayables.status, 'UNPAID'), eq(interBranchPayables.totalAmount, 100_000))))[0].id)
    const dep = await receive(tokoA, 100_000, 100_000)
    expect((await payable(p.id)).status).toBe('PAID')

    const fixed = await correctCashDeposit(dep.id, { receivedAmount: 40_000, variances: [{ amount: -60_000, cause: 'OTHER', note: 'salah ketik' }], reason: 'salah ketik' }, owner)
    expect(fixed.settlement).toMatchObject({ payablesSettled: 1, settledAmount: 40_000 })
    expect(await payable(p.id)).toMatchObject({ status: 'PARTIAL', paidAmount: 40_000 })

    const pays = await db.select().from(interBranchPayments).where(eq(interBranchPayments.payableId, p.id)).orderBy(asc(interBranchPayments.id))
    expect(pays.map((x) => [x.sourceType, x.amount])).toEqual([['SETORAN', 100_000], ['BATAL_SETORAN', -100_000], ['SETORAN', 40_000]])
    const oldRows = await db.select().from(depositSettlements)
      .where(and(eq(depositSettlements.sourceType, 'CASH_DEPOSIT'), eq(depositSettlements.sourceId, dep.id)))
    expect(oldRows.reduce((t, r) => t + r.amount, 0)).toBe(0)
    await expect(db.delete(depositSettlements).where(eq(depositSettlements.sourceId, dep.id))).rejects.toThrow()
  })
})
