import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, roles, users, moneyPlaces, fixedAssets, cashFlowEntries, cashFlowCategories, eq, and } from '../db'
import { createMoneyPlace } from './money-place-service'
import { cancelAsset, disposeAsset, listAssets, recordAssetPurchase } from './asset-service'
import { todayWibDate } from '../payment-date'

// F2-6d-1 Aset: catat = aset + Arus Kas "Beli aset" satu transaksi; jual = Arus Kas "Jual aset";
// batal ikut membatalkan Arus Kas tertaut; isi aset & DELETE dijaga trigger.
const run = randomUUID().slice(0, 8)
const actor = { userId: 0, canBackdate: true }
let branchId: number
let bankId: number
let drawerId: number
const today = todayWibDate()

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `AS${run}`, name: `Toko AS ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `AS${run}` }).returning())[0].id
  actor.userId = (await db.insert(users).values({ name: `AS${run}`, roleId, branchId }).returning())[0].id
  bankId = (await createMoneyPlace({
    name: `Rek AS ${run}`, kind: 'BANK', branchId, bankName: 'BCA', accountNumber: '222', heldBy: 'FINANCE',
  }, { userId: actor.userId, branchId })).id
  drawerId = (await db.select().from(moneyPlaces).where(and(eq(moneyPlaces.branchId, branchId), eq(moneyPlaces.kind, 'DRAWER'))))[0].id
})

const base = () => ({
  name: `Freezer ${run}`, assetType: 'MACHINE' as const, usefulLifeMonths: 48, branchId, purchasedOn: today,
  purchasePrice: 7_500_000, moneyPlaceId: bankId, proofPhotoUrl: null, note: null,
})

async function entry(id: number) {
  const [row] = await db
    .select({ e: cashFlowEntries, category: cashFlowCategories.name, reportKind: cashFlowCategories.reportKind })
    .from(cashFlowEntries)
    .innerJoin(cashFlowCategories, eq(cashFlowCategories.id, cashFlowEntries.categoryId))
    .where(eq(cashFlowEntries.id, id))
  return row
}

describe('Aset (DB lokal)', () => {
  it('catat pembelian menulis aset + Arus Kas Beli aset (Bukan biaya)', async () => {
    const { id, cashFlowEntryId } = await recordAssetPurchase(base(), actor)
    const e = await entry(cashFlowEntryId)
    expect(e).toMatchObject({ category: 'Beli aset', reportKind: 'NON_COST' })
    expect(e.e).toMatchObject({ type: 'EXPENSE', amount: 7_500_000, branchId, moneyPlaceId: bankId, occurredOn: today })
    const row = (await listAssets()).find((a) => a.id === id)!
    expect(row).toMatchObject({ monthlyPortion: 156_250, bookValueNow: 7_343_750, status: 'IN_USE' })

    // Isi tidak bisa diubah, tidak bisa dihapus.
    await expect(db.update(fixedAssets).set({ purchasePrice: 2_000_000 }).where(eq(fixedAssets.id, id))).rejects.toThrow()
    await expect(db.delete(fixedAssets).where(eq(fixedAssets.id, id))).rejects.toThrow()
  })

  it('menolak di bawah Rp1 juta dan laci kasir', async () => {
    await expect(recordAssetPurchase({ ...base(), purchasePrice: 900_000 }, actor)).rejects.toMatchObject({ status: 400 })
    await expect(recordAssetPurchase({ ...base(), moneyPlaceId: drawerId }, actor)).rejects.toMatchObject({ status: 400 })
  })

  it('dijual menulis Arus Kas Jual aset; batal membatalkan keduanya', async () => {
    const { id, cashFlowEntryId } = await recordAssetPurchase({ ...base(), name: `Rak ${run}`, assetType: 'FURNITURE', usefulLifeMonths: 96 }, actor)
    await disposeAsset(id, { status: 'SOLD', disposedOn: today, reason: 'dijual ke toko lain', saleAmount: 7_000_000, moneyPlaceId: bankId }, actor)
    const [a] = await db.select().from(fixedAssets).where(eq(fixedAssets.id, id))
    expect(a).toMatchObject({ status: 'SOLD', saleAmount: 7_000_000 })
    const sale = await entry(a.saleCashFlowEntryId!)
    expect(sale).toMatchObject({ category: 'Jual aset', reportKind: 'NON_INCOME' })
    expect(sale.e).toMatchObject({ type: 'INCOME', amount: 7_000_000 })
    const row = (await listAssets()).find((r) => r.id === id)!
    expect(row.disposalLoss).toBe(500_000)

    // Keadaan tidak bisa diubah lagi.
    await expect(disposeAsset(id, { status: 'LOST', disposedOn: today, reason: 'hilang', saleAmount: null, moneyPlaceId: null }, actor))
      .rejects.toMatchObject({ status: 409 })

    await cancelAsset(id, 'salah catat', actor)
    expect((await entry(cashFlowEntryId)).e.cancelledAt).not.toBeNull()
    expect((await entry(a.saleCashFlowEntryId!)).e.cancelledAt).not.toBeNull()
    await expect(cancelAsset(id, 'lagi', actor)).rejects.toMatchObject({ status: 409 })
  })

  it('rusak tanpa uang jual', async () => {
    const { id } = await recordAssetPurchase({ ...base(), name: `AC ${run}`, branchId: null }, actor)
    await disposeAsset(id, { status: 'DAMAGED', disposedOn: today, reason: 'kompresor mati', saleAmount: null, moneyPlaceId: null }, actor)
    const row = (await listAssets()).find((r) => r.id === id)!
    expect(row).toMatchObject({ status: 'DAMAGED', branchName: null, disposalLoss: 7_500_000, bookValueNow: 0 })
  })
})
