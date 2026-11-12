import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, roles, users, moneyPlaces, cashCounts, cashFlowEntries, cashFlowCategories, eq, and } from '../db'
import { createMoneyPlace } from './money-place-service'
import {
  adjustCashCount, cancelCashCount, cancelCashCountAdjustment, listCashCounts, listCountPlaces, recordCashCount,
} from './cash-count-service'
import { todayWibDate } from '../payment-date'

// F2-6e-1 Hitung Kas: catat tanpa saldo sistem, satu hitungan berlaku per tempat per tanggal, penyesuaian = Arus Kas
// kategori sistem bertanggal hitungan, batal penyesuaian/hitungan, isi & DELETE dijaga trigger.
const run = randomUUID().slice(0, 8)
const actor = { userId: 0, branchId: 0 }
let cashId: number
let drawerId: number
const today = todayWibDate()

beforeAll(async () => {
  actor.branchId = (await db.insert(branches).values({ code: `HK${run}`, name: `Toko HK ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `HK${run}` }).returning())[0].id
  actor.userId = (await db.insert(users).values({ name: `HK${run}`, roleId, branchId: actor.branchId }).returning())[0].id
  cashId = (await createMoneyPlace({ name: `Brankas HK ${run}`, kind: 'CASH', branchId: actor.branchId, heldBy: 'FINANCE' }, actor)).id
  drawerId = (await db.select().from(moneyPlaces).where(and(eq(moneyPlaces.branchId, actor.branchId), eq(moneyPlaces.kind, 'DRAWER'))))[0].id
})

async function entry(id: number) {
  const [row] = await db
    .select({ e: cashFlowEntries, category: cashFlowCategories.name, reportKind: cashFlowCategories.reportKind })
    .from(cashFlowEntries)
    .innerJoin(cashFlowCategories, eq(cashFlowCategories.id, cashFlowEntries.categoryId))
    .where(eq(cashFlowEntries.id, id))
  return row
}

describe('Hitung Kas (DB lokal)', () => {
  it('catat hitungan, tolak ganda di tanggal sama, tolak laci; isi & hapus dijaga trigger', async () => {
    const { id } = await recordCashCount({ moneyPlaceId: cashId, countedOn: today, amount: 1_250_000, note: null, photoUrl: null }, actor)
    const place = (await listCountPlaces(today)).find((p) => p.id === cashId)!
    expect(place).toMatchObject({ lastCountedOn: today, lastAmount: 1_250_000, freshness: 'FRESH' })
    expect(place).not.toHaveProperty('balance')

    await expect(recordCashCount({ moneyPlaceId: cashId, countedOn: today, amount: 1, note: null, photoUrl: null }, actor))
      .rejects.toMatchObject({ status: 409 })
    await expect(recordCashCount({ moneyPlaceId: drawerId, countedOn: today, amount: 1, note: null, photoUrl: null }, actor))
      .rejects.toMatchObject({ status: 400 })
    await expect(db.update(cashCounts).set({ amount: 2 }).where(eq(cashCounts.id, id))).rejects.toThrow()
    await expect(db.delete(cashCounts).where(eq(cashCounts.id, id))).rejects.toThrow()
  })

  it('penyesuaian menulis Arus Kas kategori sistem; batal penyesuaian lalu sesuaikan ulang; batal hitungan ikut membatalkan', async () => {
    const [count] = (await listCashCounts({ month: today.slice(0, 7), moneyPlaceId: cashId }))
    const { cashFlowEntryId } = await adjustCashCount(count.id, { direction: 'SHORT', amount: 50_000, reason: 'tidak ketemu sebabnya' }, actor)
    const e = await entry(cashFlowEntryId)
    expect(e).toMatchObject({ category: 'Selisih kas kurang', reportKind: 'COST' })
    expect(e.e).toMatchObject({ type: 'EXPENSE', amount: 50_000, moneyPlaceId: cashId, branchId: actor.branchId, occurredOn: today })
    await expect(adjustCashCount(count.id, { direction: 'OVER', amount: 1, reason: 'dobel' }, actor)).rejects.toMatchObject({ status: 409 })

    await cancelCashCountAdjustment(count.id, 'salah arah', actor)
    expect((await entry(cashFlowEntryId)).e.cancelledAt).not.toBeNull()
    const second = await adjustCashCount(count.id, { direction: 'OVER', amount: 20_000, reason: 'uang lebih' }, actor)
    expect(await entry(second.cashFlowEntryId)).toMatchObject({ category: 'Selisih kas lebih', reportKind: 'INCOME' })
    expect((await listCashCounts({ month: today.slice(0, 7), moneyPlaceId: cashId }))[0].adjustment)
      .toMatchObject({ direction: 'OVER', amount: 20_000 })

    await cancelCashCount(count.id, 'salah tempat', actor)
    expect((await entry(second.cashFlowEntryId)).e.cancelledAt).not.toBeNull()
    await expect(adjustCashCount(count.id, { direction: 'SHORT', amount: 1, reason: 'lagi' }, actor)).rejects.toMatchObject({ status: 409 })
    await expect(cancelCashCount(count.id, 'lagi', actor)).rejects.toMatchObject({ status: 409 })
    // Sesudah batal, tanggal yang sama boleh dicatat ulang.
    await recordCashCount({ moneyPlaceId: cashId, countedOn: today, amount: 1_200_000, note: 'hitung ulang', photoUrl: null }, actor)
  })
})
