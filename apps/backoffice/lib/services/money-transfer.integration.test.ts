import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, roles, users, moneyPlaces, moneyTransfers, moneyMovements, eq, and, asc } from '../db'
import { createMoneyTransfer, cancelMoneyTransfer, listMoneyTransfers, MoneyTransferError } from './money-transfer-service'
import { todayWibDate } from '../payment-date'

// F2-4c Pindah Dana (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §4) di DB lokal.
const run = randomUUID().slice(0, 8)
const today = todayWibDate()
let financeId: number
let ownerId: number
let brankasId: number
let bankId: number
let drawerId: number

beforeAll(async () => {
  const branchId = (await db.insert(branches).values({ code: `PD${run}`, name: `Toko Pindah ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `PD${run}` }).returning())[0].id
  financeId = (await db.insert(users).values({ name: `Finance ${run}`, roleId, branchId }).returning())[0].id
  ownerId = (await db.insert(users).values({ name: `Owner ${run}`, roleId, branchId }).returning())[0].id
  brankasId = (await db.insert(moneyPlaces).values({ name: `Brankas ${run}`, kind: 'CASH', branchId }).returning())[0].id
  bankId = (await db.insert(moneyPlaces).values({ name: `Rekening ${run}`, kind: 'BANK', branchId, bankName: 'BCA', accountNumber: '1', accountHolder: 'x' }).returning())[0].id
  const [drawer] = await db.select({ id: moneyPlaces.id }).from(moneyPlaces).where(and(eq(moneyPlaces.branchId, branchId), eq(moneyPlaces.kind, 'DRAWER')))
  drawerId = drawer?.id ?? 0
})

const finance = () => ({ userId: financeId, isOwner: false, canCancelAny: false })
const input = (over: Partial<Parameters<typeof createMoneyTransfer>[0]> = {}) => ({
  fromMoneyPlaceId: brankasId, toMoneyPlaceId: bankId, amount: 2_000_000, occurredOn: today, note: 'setor BCA', proofPhotoUrl: null, ...over,
})

describe('Pindah Dana F2-4c (DB lokal)', () => {
  it('mencatat pindah + satu perpindahan uang TRANSFER', async () => {
    const t = await createMoneyTransfer(input(), finance())
    const moves = await db.select().from(moneyMovements).where(and(eq(moneyMovements.sourceType, 'TRANSFER'), eq(moneyMovements.sourceId, t.id)))
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ fromMoneyPlaceId: brankasId, toMoneyPlaceId: bankId, amount: 2_000_000 })
  })

  it('menolak asal = tujuan, laci, dan tanggal masa depan', async () => {
    await expect(createMoneyTransfer(input({ toMoneyPlaceId: brankasId }), finance())).rejects.toBeInstanceOf(MoneyTransferError)
    if (drawerId) await expect(createMoneyTransfer(input({ fromMoneyPlaceId: drawerId }), finance())).rejects.toThrow(/Laci/)
    await expect(createMoneyTransfer(input({ occurredOn: '2999-01-01' }), finance())).rejects.toThrow(/melewati/)
  })

  it('batal: pembalikan negatif, tetap terlihat, tidak bisa dibatalkan dua kali; database menolak ubah/hapus', async () => {
    const t = await createMoneyTransfer(input({ amount: 500_000 }), finance())
    await expect(cancelMoneyTransfer(t.id, '', finance())).rejects.toThrow(/Alasan/)
    await cancelMoneyTransfer(t.id, 'salah tujuan', finance())
    await expect(cancelMoneyTransfer(t.id, 'lagi', { userId: ownerId, isOwner: true, canCancelAny: true })).rejects.toThrow(/sudah dibatalkan/)

    const moves = await db.select().from(moneyMovements)
      .where(and(eq(moneyMovements.sourceType, 'TRANSFER'), eq(moneyMovements.sourceId, t.id))).orderBy(asc(moneyMovements.id))
    expect(moves.map((m) => m.amount)).toEqual([500_000, -500_000])
    expect(moves[1].reversalOfId).toBe(moves[0].id)

    await expect(db.update(moneyTransfers).set({ amount: 1 }).where(eq(moneyTransfers.id, t.id))).rejects.toThrow()
    await expect(db.delete(moneyTransfers).where(eq(moneyTransfers.id, t.id))).rejects.toThrow()

    const visible = await listMoneyTransfers({ from: today, to: today }, finance())
    const all = await listMoneyTransfers({ from: today, to: today, includeCancelled: true }, finance())
    expect(visible.some((r) => r.id === t.id)).toBe(false)
    expect(all.find((r) => r.id === t.id)?.cancelReason).toBe('salah tujuan')
  })

  it('orang lain tanpa cashflow.cancel tidak bisa membatalkan; Owner/GM bisa', async () => {
    const t = await createMoneyTransfer(input({ amount: 100_000 }), finance())
    await expect(cancelMoneyTransfer(t.id, 'bukan punya saya', { userId: ownerId, isOwner: false, canCancelAny: false })).rejects.toThrow(/Owner\/GM/)
    await cancelMoneyTransfer(t.id, 'dobel catat', { userId: ownerId, isOwner: true, canCancelAny: true })
  })
})
