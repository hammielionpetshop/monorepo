import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, roles, users, moneyPlaces, moneyPlaceOpeningBalances, auditLogs, eq, and } from '../db'
import { createMoneyPlace } from './money-place-service'
import { cancelOpeningBalance, listOpeningBalances, setOpeningBalance } from './money-place-opening-balance-service'

// F2-6a-1 Saldo awal Tempat Uang: hanya Tunai/Rekening, satu yang berlaku per tempat,
// tidak diubah/dihapus (dijaga DB), salah = batal beralasan lalu isi ulang.
const run = randomUUID().slice(0, 8)
let actor: { userId: number; branchId: number }
let branchId: number
let bankId: number
let drawerId: number

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `OB${run}`, name: `Toko OB ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `OB${run}` }).returning())[0].id
  const userId = (await db.insert(users).values({ name: `OB${run}`, roleId, branchId }).returning())[0].id
  actor = { userId, branchId }
  bankId = (await createMoneyPlace({
    name: `Rek OB ${run}`, kind: 'BANK', branchId, bankName: 'BCA', accountNumber: '111', heldBy: 'FINANCE',
  }, actor)).id
  drawerId = (await db.select().from(moneyPlaces).where(and(eq(moneyPlaces.branchId, branchId), eq(moneyPlaces.kind, 'DRAWER'))))[0].id
})

describe('Saldo awal Tempat Uang (DB lokal)', () => {
  it('laci ditolak (layanan dan database)', async () => {
    await expect(setOpeningBalance({ moneyPlaceId: drawerId, amount: 1000, note: null, proofPhotoUrl: null }, actor))
      .rejects.toMatchObject({ code: 'DRAWER', status: 400 })
    await expect(db.insert(moneyPlaceOpeningBalances).values({ moneyPlaceId: drawerId, amount: 1, createdBy: actor.userId }))
      .rejects.toThrow()
  })

  it('isi sekali per 1 Nov 2026; kedua kali ditolak; tidak bisa diubah/dihapus; batal lalu isi ulang', async () => {
    const first = await setOpeningBalance({ moneyPlaceId: bankId, amount: 12_350_000, note: 'mutasi BCA', proofPhotoUrl: null }, actor)
    const [row] = await db.select().from(moneyPlaceOpeningBalances).where(eq(moneyPlaceOpeningBalances.id, first.id))
    expect(row).toMatchObject({ asOf: '2026-11-01', amount: 12_350_000, cancelledAt: null })

    await expect(setOpeningBalance({ moneyPlaceId: bankId, amount: 5, note: null, proofPhotoUrl: null }, actor))
      .rejects.toMatchObject({ code: 'ALREADY_SET', status: 409 })
    await expect(db.update(moneyPlaceOpeningBalances).set({ amount: 1 }).where(eq(moneyPlaceOpeningBalances.id, first.id)))
      .rejects.toThrow()
    await expect(db.delete(moneyPlaceOpeningBalances).where(eq(moneyPlaceOpeningBalances.id, first.id))).rejects.toThrow()
    // Tanggal lain ditolak CHECK.
    await expect(db.insert(moneyPlaceOpeningBalances).values({ moneyPlaceId: bankId, asOf: '2026-12-01', amount: 1, createdBy: actor.userId }))
      .rejects.toThrow()

    await cancelOpeningBalance(first.id, 'salah ketik', actor)
    await expect(cancelOpeningBalance(first.id, 'lagi', actor)).rejects.toMatchObject({ code: 'ALREADY_CANCELLED' })
    // Pembatalan tidak bisa diulang/diubah langsung di DB.
    await expect(db.update(moneyPlaceOpeningBalances).set({ cancelReason: 'ganti' }).where(eq(moneyPlaceOpeningBalances.id, first.id)))
      .rejects.toThrow()

    const second = await setOpeningBalance({ moneyPlaceId: bankId, amount: 12_530_000, note: null, proofPhotoUrl: null }, actor)
    const mine = (await listOpeningBalances()).filter((r) => r.moneyPlaceId === bankId)
    expect(mine.map((r) => [r.id, r.amount, r.cancelReason])).toEqual([
      [second.id, 12_530_000, null],
      [first.id, 12_350_000, 'salah ketik'],
    ])

    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.tableName, 'money_place_opening_balances'), eq(auditLogs.userId, actor.userId)))
    expect(logs.map((l) => l.action).sort()).toEqual(['OPENING_BALANCE_CANCEL', 'OPENING_BALANCE_SET', 'OPENING_BALANCE_SET'])
  })
})
