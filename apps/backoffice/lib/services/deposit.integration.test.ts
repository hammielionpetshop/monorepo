import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, roles, users, paymentMethods, moneyPlaces, shifts, shiftCashierBreakdown, transactions,
  transactionPayments, cashDeposits, cashDepositShifts, moneyMovements, noncashVerifications, paymentMethodMoneyPlaces,
  appSettings, eq, and, isNull,
} from '../db'
import {
  reportCashDeposit, verifyCashDeposit, receiveCashDeposit, cancelCashDeposit, correctCashDeposit,
  saveNoncashVerification, correctNoncashVerification, getDepositSettings, type DepositActor,
} from './deposit-service'
import { listUndepositedShifts, listNoncashRows, getShiftDepositStatus } from './deposit-queries'
import { getCashierVarianceReport } from './cashier-variance-service'
import { todayWibDate } from '../payment-date'

// F2-2 Setoran (spec §8): aturan setoran tunai, verifikasi non-tunai, perpindahan uang, Minus Kasir.
const run = randomUUID().slice(0, 8)
let finance: DepositActor
let owner: DepositActor
let kasirId: number
let kasir2Id: number
let branchA: number
let branchB: number
let bankA: number
let brankas: number
let drawerA: number
let qrisId: number
let unlinkedId: number
let shiftSeq = 0

async function makeShift(branchId: number, opts: { cash: number; expected?: number; status?: string; origin?: string; cashiers?: number[] } = { cash: 0 }) {
  shiftSeq += 1
  const cashiers = opts.cashiers ?? [kasirId]
  const status = opts.status ?? 'CLOSED'
  const [s] = await db.insert(shifts).values({
    branchId, openedById: kasirId, shiftNumber: 900 + shiftSeq, assignedCashiers: cashiers, openingCash: 100_000,
    status, origin: opts.origin ?? 'POS',
    closedAt: status === 'CLOSED' ? new Date() : null,
    forceClosedAt: status === 'FORCE_CLOSED' ? new Date() : null,
    totalClosingCashReal: status === 'OPEN' ? null : status === 'FORCE_CLOSED' ? 0 : opts.cash,
    totalClosingCashExpected: status === 'OPEN' ? null : opts.expected ?? opts.cash,
  }).returning()
  for (const c of cashiers) {
    await db.insert(shiftCashierBreakdown).values({ shiftId: s.id, cashierId: c, totalSalesCash: Math.floor((opts.expected ?? opts.cash) / cashiers.length) })
  }
  return s.id
}

async function addQrisSale(shiftId: number, branchId: number, amount: number, status = 'COMPLETED') {
  const [t] = await db.insert(transactions).values({
    trxNumber: `T${run}-${randomUUID().slice(0, 6)}`, branchId, shiftId, cashierId: kasirId,
    totalAmount: amount, payableAmount: amount, paidAmount: amount, changeAmount: 0, status,
  }).returning()
  await db.insert(transactionPayments).values({ transactionId: t.id, paymentMethodId: qrisId, amount })
  return t.id
}

beforeAll(async () => {
  branchA = (await db.insert(branches).values({ code: `DA${run}`, name: `Setor A ${run}` }).returning())[0].id
  branchB = (await db.insert(branches).values({ code: `DB${run}`, name: `Setor B ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `DP${run}` }).returning())[0].id
  const fin = (await db.insert(users).values({ name: `Fin ${run}`, roleId, branchId: branchA }).returning())[0].id
  kasirId = (await db.insert(users).values({ name: `Kasir ${run}`, roleId, branchId: branchA }).returning())[0].id
  kasir2Id = (await db.insert(users).values({ name: `Kasir2 ${run}`, roleId, branchId: branchA }).returning())[0].id
  finance = { userId: fin, branchId: branchA, role: 'FINANCE' }
  owner = { userId: fin, branchId: branchA, role: 'OWNER' }
  bankA = (await db.insert(moneyPlaces).values({ name: `Rek A ${run}`, kind: 'BANK', branchId: branchA, bankName: 'BCA', accountNumber: run }).returning())[0].id
  brankas = (await db.insert(moneyPlaces).values({ name: `Brankas ${run}`, kind: 'CASH', branchId: branchA }).returning())[0].id
  drawerA = (await db.select().from(moneyPlaces).where(and(eq(moneyPlaces.branchId, branchA), eq(moneyPlaces.kind, 'DRAWER'))))[0].id
  qrisId = (await db.insert(paymentMethods).values({ name: `QRIS ${run}`, type: 'QRIS' }).returning())[0].id
  unlinkedId = (await db.insert(paymentMethods).values({ name: `EW ${run}`, type: 'E-WALLET' }).returning())[0].id
  await db.insert(paymentMethodMoneyPlaces).values({ paymentMethodId: qrisId, branchId: branchA, moneyPlaceId: bankA })
  // Pastikan tanggal mulai tidak di masa depan (DB lokal bisa dimigrasi kemarin atau hari ini).
  const settings = await getDepositSettings()
  if (settings.startDate > todayWibDate()) {
    await db.update(appSettings).set({ value: JSON.stringify({ ...settings, startDate: todayWibDate() }) }).where(eq(appSettings.key, 'deposit_settings'))
  }
})

const today = () => todayWibDate()

describe('Setoran Tunai (DB lokal)', () => {
  it('menolak shift cabang lain, shift terbuka, shift ganda, dan tujuan Laci/Tunai dari POS', async () => {
    const a1 = await makeShift(branchA, { cash: 100_000 })
    const b1 = await makeShift(branchB, { cash: 50_000 })
    const open = await makeShift(branchA, { cash: 0, status: 'OPEN' })
    const base = { branchId: branchA, destinationMoneyPlaceId: bankA, reportedAmount: 100_000, depositDate: today() }

    await expect(reportCashDeposit({ ...base, shiftIds: [a1, b1] }, finance)).rejects.toThrow(/cabang yang sama/)
    await expect(reportCashDeposit({ ...base, shiftIds: [open] }, finance)).rejects.toThrow(/masih berjalan/)
    await expect(reportCashDeposit({ ...base, shiftIds: [a1], destinationMoneyPlaceId: drawerA }, finance)).rejects.toThrow(/Laci/)
    await expect(reportCashDeposit({ ...base, shiftIds: [a1], destinationMoneyPlaceId: brankas }, finance)).rejects.toThrow(/Rekening/)

    const dep = await reportCashDeposit({ ...base, shiftIds: [a1] }, finance)
    expect(dep).toMatchObject({ status: 'PENDING', reportChannel: 'POS' })
    expect(dep.depositNumber).toMatch(new RegExp(`^STN-DA${run.toUpperCase()}-\\d{6}-01$`))
    await expect(reportCashDeposit({ ...base, shiftIds: [a1] }, finance)).rejects.toMatchObject({ code: 'SHIFT_TAKEN' })
  })

  it('batal membebaskan shift kembali ke Tunai belum disetor; verifikasi mencatat perpindahan uang sebesar diketik', async () => {
    const s1 = await makeShift(branchA, { cash: 200_000 })
    const s2 = await makeShift(branchA, { cash: 300_000 })
    const dep = await reportCashDeposit({ branchId: branchA, shiftIds: [s1, s2], destinationMoneyPlaceId: bankA, reportedAmount: 500_000, depositDate: today() }, finance)
    expect((await listUndepositedShifts({ branchId: branchA })).some((s) => s.shiftId === s1)).toBe(false)

    await expect(cancelCashDeposit(dep.id, '  ', finance, { branchId: null })).rejects.toThrow(/Alasan/)
    await cancelCashDeposit(dep.id, 'salah pilih', finance, { branchId: branchA })
    expect((await listUndepositedShifts({ branchId: branchA })).filter((s) => [s1, s2].includes(s.shiftId))).toHaveLength(2)
    await expect(verifyCashDeposit(dep.id, { receivedAmount: 500_000, variances: [] }, finance)).rejects.toThrow(/tidak sedang menunggu/)

    const dep2 = await reportCashDeposit({ branchId: branchA, shiftIds: [s1, s2], destinationMoneyPlaceId: bankA, reportedAmount: 500_000, depositDate: today() }, finance)
    // Rincian sebab wajib menutup seluruh selisih.
    await expect(verifyCashDeposit(dep2.id, { receivedAmount: 495_000, variances: [] }, finance)).rejects.toThrow(/wajib/)
    await expect(verifyCashDeposit(dep2.id, { receivedAmount: 495_000, variances: [{ amount: -3_000, cause: 'BANK_FEE' }] }, finance)).rejects.toThrow(/harus sama/)
    const verified = await verifyCashDeposit(dep2.id, { receivedAmount: 495_000, variances: [{ amount: -5_000, cause: 'BANK_FEE' }] }, finance)
    expect(verified).toMatchObject({ status: 'VERIFIED', receivedAmount: 495_000, verifiedHeldBy: 'FINANCE' })

    const moves = await db.select().from(moneyMovements).where(and(eq(moneyMovements.sourceType, 'CASH_DEPOSIT'), eq(moneyMovements.sourceId, dep2.id)))
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ fromMoneyPlaceId: drawerA, toMoneyPlaceId: bankA, amount: 495_000 })
    await expect(db.delete(moneyMovements).where(eq(moneyMovements.id, moves[0].id))).rejects.toThrow()
  })

  it('Terima Setoran langsung terverifikasi; kurang dari kasir wajib shift & kasir yang bertugas; masuk Minus Kasir', async () => {
    const s1 = await makeShift(branchB, { cash: 150_000, cashiers: [kasirId, kasir2Id] })
    const input = { branchId: branchB, shiftIds: [s1], destinationMoneyPlaceId: brankas, depositDate: today(), receivedAmount: 140_000 }
    await expect(receiveCashDeposit({ ...input, variances: [{ amount: -10_000, cause: 'CASHIER_SHORT' }] }, finance)).rejects.toThrow(/pilih shift/)
    await expect(receiveCashDeposit({ ...input, variances: [{ amount: -10_000, cause: 'CASHIER_SHORT', shiftId: s1, cashierId: finance.userId }] }, finance))
      .rejects.toThrow(/tidak bertugas/)
    const dep = await receiveCashDeposit({ ...input, variances: [{ amount: -10_000, cause: 'CASHIER_SHORT', shiftId: s1, cashierId: kasir2Id }] }, finance)
    expect(dep).toMatchObject({ status: 'VERIFIED', reportChannel: 'BACKOFFICE', receivedAmount: 140_000 })

    const report = await getCashierVarianceReport({ month: today().slice(0, 7), branchId: branchB })
    const row = report!.shifts.find((s) => s.shiftId === s1)!
    expect(row.variance).toBe(-10_000)
    expect(row.allocations.find((a) => a.cashierId === kasir2Id)?.amount).toBe(-10_000)
    expect(row.allocations.find((a) => a.cashierId === kasirId)?.amount ?? 0).toBe(0)
  })

  it('biaya setor bank tidak masuk Minus Kasir; selisih tutup shift tetap terbaca', async () => {
    const s1 = await makeShift(branchA, { cash: 90_000, expected: 100_000 })
    const dep = await receiveCashDeposit({
      branchId: branchA, shiftIds: [s1], destinationMoneyPlaceId: bankA, depositDate: today(), receivedAmount: 85_000,
      variances: [{ amount: -5_000, cause: 'BANK_FEE' }],
    }, finance)
    expect(dep.status).toBe('VERIFIED')
    const report = await getCashierVarianceReport({ month: today().slice(0, 7), branchId: branchA })
    expect(report!.shifts.find((s) => s.shiftId === s1)!.variance).toBe(-10_000)
  })

  it('koreksi oleh Owner/GM: setoran lama CORRECTED + pembalikan, setoran koreksi menautkan yang lama', async () => {
    const s1 = await makeShift(branchA, { cash: 60_000 })
    const dep = await receiveCashDeposit({ branchId: branchA, shiftIds: [s1], destinationMoneyPlaceId: brankas, depositDate: today(), receivedAmount: 60_000, variances: [] }, finance)
    await expect(correctCashDeposit(dep.id, { receivedAmount: 55_000, variances: [{ amount: -5_000, cause: 'OTHER', note: 'x' }], reason: 'salah ketik' }, finance))
      .rejects.toThrow(/Owner\/GM/)
    const fixed = await correctCashDeposit(dep.id, { receivedAmount: 55_000, variances: [{ amount: -5_000, cause: 'OTHER', note: 'hilang' }], reason: 'salah ketik' }, owner)
    expect(fixed).toMatchObject({ status: 'VERIFIED', correctsDepositId: dep.id, receivedAmount: 55_000 })
    const [old] = await db.select().from(cashDeposits).where(eq(cashDeposits.id, dep.id))
    expect(old).toMatchObject({ status: 'CORRECTED', receivedAmount: 60_000 })
    const oldMoves = await db.select().from(moneyMovements).where(and(eq(moneyMovements.sourceType, 'CASH_DEPOSIT'), eq(moneyMovements.sourceId, dep.id)))
    expect(oldMoves.map((m) => m.amount).sort((a, b) => a - b)).toEqual([-60_000, 60_000])
    const active = await db.select().from(cashDepositShifts).where(and(eq(cashDepositShifts.shiftId, s1), isNull(cashDepositShifts.releasedAt)))
    expect(active).toHaveLength(1)
    expect(active[0].depositId).toBe(fixed.id)
    expect((await getShiftDepositStatus(s1)).cash).toMatchObject({ state: 'VERIFIED', depositId: fixed.id })
  })
})

describe('Verifikasi non-tunai (DB lokal)', () => {
  it('angka sistem = nota COMPLETED saja; metode belum ditautkan ditolak; dana belum cair lalu diverifikasi', async () => {
    const s1 = await makeShift(branchA, { cash: 0 })
    await addQrisSale(s1, branchA, 70_000)
    await addQrisSale(s1, branchA, 30_000, 'VOIDED')
    const rows = await listNoncashRows({ branchId: branchA, shiftId: s1 })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ expected: 70_000, status: 'PENDING', linkedPlaceName: `Rek A ${run}` })

    await expect(saveNoncashVerification({ shiftId: s1, branchId: branchA, businessDate: null, paymentMethodId: unlinkedId, awaitingFunds: false, receivedAmount: 0 }, finance))
      .rejects.toMatchObject({ code: 'NOT_LINKED' })

    const key = { shiftId: s1, branchId: branchA, businessDate: null, paymentMethodId: qrisId }
    await expect(saveNoncashVerification({ ...key, awaitingFunds: false }, finance)).rejects.toThrow(/wajib diketik/)
    const waiting = await saveNoncashVerification({ ...key, awaitingFunds: true, note: 'belum masuk' }, finance)
    expect(waiting.status).toBe('AWAITING_FUNDS')
    expect(await db.select().from(moneyMovements).where(and(eq(moneyMovements.sourceType, 'NONCASH_VERIFICATION'), eq(moneyMovements.sourceId, waiting.id)))).toHaveLength(0)

    await expect(saveNoncashVerification({ ...key, awaitingFunds: false, receivedAmount: 69_300 }, finance)).rejects.toThrow(/sebab/)
    const done = await saveNoncashVerification({ ...key, awaitingFunds: false, receivedAmount: 69_300, cause: 'BANK_FEE' }, finance)
    expect(done).toMatchObject({ id: waiting.id, status: 'VERIFIED', variance: -700, moneyPlaceId: bankA })
    const moves = await db.select().from(moneyMovements).where(and(eq(moneyMovements.sourceType, 'NONCASH_VERIFICATION'), eq(moneyMovements.sourceId, done.id)))
    expect(moves).toEqual([expect.objectContaining({ fromMoneyPlaceId: null, toMoneyPlaceId: bankA, amount: 69_300 })])
    await expect(saveNoncashVerification({ ...key, awaitingFunds: false, receivedAmount: 70_000 }, finance)).rejects.toThrow(/sudah diverifikasi/)

    // Koreksi: baris lama digantikan, pembalikan + perpindahan baru.
    const fixed = await correctNoncashVerification(done.id, { receivedAmount: 70_000, reason: 'mutasi susulan' }, owner)
    const [old] = await db.select().from(noncashVerifications).where(eq(noncashVerifications.id, done.id))
    expect(old.supersededById).toBe(fixed.id)
    expect(old.receivedAmount).toBe(69_300)
    const reversed = await db.select().from(moneyMovements).where(and(eq(moneyMovements.sourceType, 'NONCASH_VERIFICATION'), eq(moneyMovements.sourceId, done.id)))
    expect(reversed.map((m) => m.amount).sort((a, b) => a - b)).toEqual([-69_300, 69_300])
    expect((await listNoncashRows({ branchId: branchA, shiftId: s1 }))[0]).toMatchObject({ status: 'VERIFIED', received: 70_000, variance: 0 })
  })

  it('salah input kasir masuk Minus Kasir; potongan bank tidak', async () => {
    const s1 = await makeShift(branchB, { cash: 40_000 })
    await db.insert(paymentMethodMoneyPlaces).values({ paymentMethodId: qrisId, branchId: branchB, moneyPlaceId: bankA })
    await addQrisSale(s1, branchB, 50_000)
    await receiveCashDeposit({ branchId: branchB, shiftIds: [s1], destinationMoneyPlaceId: brankas, depositDate: today(), receivedAmount: 40_000, variances: [] }, finance)
    await saveNoncashVerification({
      shiftId: s1, branchId: branchB, businessDate: null, paymentMethodId: qrisId, awaitingFunds: false,
      receivedAmount: 45_000, cause: 'CASHIER_INPUT', cashierId: kasirId,
    }, finance)
    const report = await getCashierVarianceReport({ month: today().slice(0, 7), branchId: branchB })
    const row = report!.shifts.find((s) => s.shiftId === s1)!
    expect(row.variance).toBe(-5_000)
    expect(row.allocations).toEqual([expect.objectContaining({ cashierId: kasirId, amount: -5_000 })])
  })
})
