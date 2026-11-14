import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  db, branches, roles, users, cashFlowCategories, cashFlowEntries, moneyTransfers, cashCounts, fixedAssets, monthClosings,
  moneyPlaceOpeningBalances, eq, and,
} from '../db'
import { createMoneyPlace } from './money-place-service'
import { closedMonthMessage } from '../db-errors'

// F2-6f Tutup Bulan: penutupan dijaga trigger (bulan lewat, berurutan, tanpa ubah/hapus) dan catatan uang Back Office
// bertanggal di bulan tertutup ditolak dengan galat HM001. Bulan berjalan (November 2026) belum bisa ditutup lewat jalur
// biasa, jadi penutupan disisipkan dengan trigger dimatikan di dalam transaksi yang selalu dibatalkan.
const run = randomUUID().slice(0, 8)
let userId: number
let branchId: number
let cashId: number
let bankId: number
let costCategoryId: number
let systemCategoryId: number

class Rollback extends Error {}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `TB${run}`, name: `Toko TB ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `TB${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `TB${run}`, roleId, branchId }).returning())[0].id
  const actor = { userId, branchId }
  cashId = (await createMoneyPlace({ name: `Brankas TB ${run}`, kind: 'CASH', branchId, heldBy: 'FINANCE' }, actor)).id
  bankId = (await createMoneyPlace({ name: `Bank TB ${run}`, kind: 'CASH', branchId, heldBy: 'FINANCE' }, actor)).id
  costCategoryId = (await db.insert(cashFlowCategories).values({ name: `Listrik TB ${run}`, type: 'EXPENSE', reportKind: 'COST' }).returning())[0].id
  systemCategoryId = (await db.select().from(cashFlowCategories)
    .where(and(eq(cashFlowCategories.name, 'Sewa toko'), eq(cashFlowCategories.type, 'EXPENSE'))))[0].id
})

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Jalankan isi di dalam transaksi yang selalu dibatalkan, dengan November 2026 sudah ditutup. */
async function withNovemberClosed(body: (tx: Tx) => Promise<void>) {
  await expect(db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`)
    await tx.insert(monthClosings).values({ month: '2026-11-01', closedBy: userId, snapshot: {} })
    await tx.execute(sql`set local session_replication_role = origin`)
    await body(tx)
    throw new Rollback()
  })).rejects.toBeInstanceOf(Rollback)
}

/** Pernyataan harus ditolak sebagai bulan tertutup; savepoint menjaga transaksi luar tetap hidup. */
async function expectClosed(tx: Tx, action: (sp: Tx) => Promise<unknown>) {
  let caught: unknown = null
  try {
    await tx.transaction(async (sp) => { await action(sp) })
  } catch (error) {
    caught = error
  }
  expect(closedMonthMessage(caught)).toMatch(/^Bulan November 2026 sudah ditutup/)
}

const entry = (over: Partial<typeof cashFlowEntries.$inferInsert> = {}) => ({
  type: 'EXPENSE', categoryId: costCategoryId, branchId, amount: 10_000, createdBy: userId,
  occurredOn: '2026-11-05', forMonth: '2026-11-01', moneyPlaceId: cashId, ...over,
})

describe('Tutup Bulan (DB lokal)', () => {
  it('bulan berjalan tidak bisa ditutup; penutupan tidak bisa diubah atau dihapus', async () => {
    const thisMonth = `${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7)}-01`
    await expect(db.insert(monthClosings).values({ month: thisMonth, closedBy: userId, snapshot: {} })).rejects.toThrow()
    await withNovemberClosed(async (tx) => {
      for (const action of [
        (sp: Tx) => sp.update(monthClosings).set({ note: 'ubah' }).where(eq(monthClosings.month, '2026-11-01')),
        (sp: Tx) => sp.delete(monthClosings).where(eq(monthClosings.month, '2026-11-01')),
      ]) {
        await expect(tx.transaction(async (sp) => { await action(sp) })).rejects.toThrow()
      }
    })
  })

  it('Arus Kas, Pindah Dana, Hitung Kas, Aset, dan Saldo awal bertanggal November ditolak sesudah ditutup', async () => {
    // Catatan yang sudah ada sebelum ditutup (untuk uji batal).
    const [oldEntry] = await db.insert(cashFlowEntries).values(entry()).returning()
    const [oldTransfer] = await db.insert(moneyTransfers)
      .values({ fromMoneyPlaceId: cashId, toMoneyPlaceId: bankId, amount: 5_000, occurredOn: '2026-11-03', createdBy: userId }).returning()
    const [oldCount] = await db.insert(cashCounts).values({ moneyPlaceId: cashId, countedOn: '2026-11-04', amount: 1, createdBy: userId }).returning()
    const [opening] = await db.insert(moneyPlaceOpeningBalances).values({ moneyPlaceId: cashId, amount: 100, createdBy: userId }).returning()
    const cancel = { cancelledAt: new Date(), cancelledBy: userId, cancelReason: 'uji tutup bulan' }

    await withNovemberClosed(async (tx) => {
      await expectClosed(tx, (sp) => sp.insert(cashFlowEntries).values(entry()))
      // Untuk bulan November dengan tanggal uang Desember: ditolak untuk kategori biasa, boleh untuk kategori sistem.
      await expectClosed(tx, (sp) => sp.insert(cashFlowEntries).values(entry({ occurredOn: '2026-12-01' })))
      await tx.insert(cashFlowEntries).values(entry({ occurredOn: '2026-12-01', categoryId: systemCategoryId }))
      await expectClosed(tx, (sp) => sp.update(cashFlowEntries).set(cancel).where(eq(cashFlowEntries.id, oldEntry.id)))

      await expectClosed(tx, (sp) => sp.insert(moneyTransfers)
        .values({ fromMoneyPlaceId: cashId, toMoneyPlaceId: bankId, amount: 1, occurredOn: '2026-11-30', createdBy: userId }))
      await expectClosed(tx, (sp) => sp.update(moneyTransfers).set(cancel).where(eq(moneyTransfers.id, oldTransfer.id)))

      await expectClosed(tx, (sp) => sp.insert(cashCounts).values({ moneyPlaceId: bankId, countedOn: '2026-11-30', amount: 1, createdBy: userId }))
      await expectClosed(tx, (sp) => sp.update(cashCounts).set(cancel).where(eq(cashCounts.id, oldCount.id)))

      await expectClosed(tx, (sp) => sp.update(moneyPlaceOpeningBalances).set(cancel).where(eq(moneyPlaceOpeningBalances.id, opening.id)))
      await expectClosed(tx, (sp) => sp.insert(moneyPlaceOpeningBalances).values({ moneyPlaceId: bankId, amount: 1, createdBy: userId }))

      const [purchase] = await tx.insert(cashFlowEntries)
        .values(entry({ occurredOn: '2026-12-02', forMonth: '2026-12-01', categoryId: systemCategoryId })).returning()
      await expectClosed(tx, (sp) => sp.insert(fixedAssets).values({
        name: 'Freezer', assetType: 'MACHINE', branchId, purchasePrice: 1_000_000, purchasedOn: '2026-11-20', usefulLifeMonths: 12,
        purchaseCashFlowEntryId: purchase.id, createdBy: userId,
      }))

      // Bulan yang belum ditutup tetap terbuka.
      await tx.insert(moneyTransfers)
        .values({ fromMoneyPlaceId: cashId, toMoneyPlaceId: bankId, amount: 1, occurredOn: '2026-12-01', createdBy: userId })
    })

    // Sesudah transaksi dibatalkan (November terbuka lagi di DB uji), catatan lama bisa dibatalkan seperti biasa.
    await db.update(moneyTransfers).set(cancel).where(eq(moneyTransfers.id, oldTransfer.id))
  })

  it('Koreksi bulan lalu (F2-6f-3): boleh ke bulan tertutup, ditolak ke bulan terbuka, dan bisa dibatalkan', async () => {
    const reason = 'listrik November lupa dicatat'
    await withNovemberClosed(async (tx) => {
      // Catatan biasa Untuk bulan November tetap ditolak, pesannya mengarahkan ke Koreksi bulan lalu.
      await expectClosed(tx, (sp) => sp.insert(cashFlowEntries).values(entry({ occurredOn: '2026-12-03' })))
      const [fix] = await tx.insert(cashFlowEntries)
        .values(entry({ occurredOn: '2026-12-03', correctionReason: reason })).returning()
      expect(fix.correctionReason).toBe(reason)
      // Tanggal uang di bulan tertutup tetap ditolak walau koreksi.
      await expectClosed(tx, (sp) => sp.insert(cashFlowEntries).values(entry({ occurredOn: '2026-11-30', forMonth: '2026-10-01', correctionReason: reason })))
      // Batal koreksi (tanggal uang Desember) diterima.
      await tx.update(cashFlowEntries).set({ cancelledAt: new Date(), cancelledBy: userId, cancelReason: 'salah jumlah' })
        .where(eq(cashFlowEntries.id, fix.id))
    })

    // Bulan asal yang belum ditutup: HM002.
    let caught: unknown = null
    try {
      await db.insert(cashFlowEntries).values(entry({ occurredOn: '2026-12-03', correctionReason: reason }))
    } catch (error) {
      caught = error
    }
    expect(closedMonthMessage(caught)).toMatch(/^Koreksi bulan lalu hanya untuk bulan yang sudah ditutup/)

    // CHECK: alasan pendek atau bulan asal tidak sebelum tanggal uang ditolak.
    await expect(db.insert(cashFlowEntries).values(entry({ occurredOn: '2026-12-03', correctionReason: 'abc' }))).rejects.toThrow()
    await expect(db.insert(cashFlowEntries).values(entry({ occurredOn: '2026-11-05', correctionReason: reason }))).rejects.toThrow()
  })
})
