import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, roles, users, shifts, interBranchTransfers, interBranchPayables, interBranchPayments,
  depositSettlements, legacySettlementRuns, eq, and, asc, inArray,
} from '../db'
import { simulateLegacySettlement, simulationTotals, summarizeBranchMoney } from './legacy-settlement-rules'
import { loadLegacyPreviewData } from './legacy-settlement-service'
import { cancelLegacyRun, runLegacySettlement } from './legacy-settlement-run'
import { DepositError } from './deposit-error'

// F2-3b-2 (spec §6): Jalankan = hasil sama dengan pratinjau, ditolak bila data berubah, tidak bisa dua
// pelaksanaan aktif; Batalkan membalik semua baris dan status utang kembali.
const run = randomUUID().slice(0, 8)
const FROM = '2026-10-20'
const options = { includeNoncash: false, subtractManual: true }
let ownerId: number
let tokoA: number
let pusat: number
let gudang: number
let aPusat: number
let pusatGudang: number
let seq = 0

async function makePayable(debtor: number, creditor: number, amount: number, createdAt: Date) {
  seq += 1
  const [t] = await db.insert(interBranchTransfers).values({
    ibtNumber: `IBT-L${run}-${seq}`, sourceBranchId: creditor, destinationBranchId: debtor, requestedById: ownerId, status: 'RECEIVED',
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

async function preview() {
  const data = await loadLegacyPreviewData(FROM)
  return simulationTotals(simulateLegacySettlement(data.payables, summarizeBranchMoney(data), options))
}

beforeAll(async () => {
  tokoA = (await db.insert(branches).values({ code: `LA${run}`, name: `Toko A ${run}` }).returning())[0].id
  pusat = (await db.insert(branches).values({ code: `LP${run}`, name: `Pusat ${run}` }).returning())[0].id
  gudang = (await db.insert(branches).values({ code: `LG${run}`, name: `Gudang ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `LT${run}` }).returning())[0].id
  ownerId = (await db.insert(users).values({ name: `Owner ${run}`, roleId, branchId: gudang }).returning())[0].id
  // Sisa pelaksanaan aktif dari tes sebelumnya yang gagal di tengah jangan menghalangi tes ini.
  for (const r of await db.select().from(legacySettlementRuns).where(eq(legacySettlementRuns.status, 'ACTIVE'))) {
    await cancelLegacyRun({ runId: r.id, reason: 'bersihkan sisa tes', userId: ownerId })
  }
  aPusat = await makePayable(tokoA, pusat, 300_000, new Date('2026-10-15T10:00:00+07:00'))
  pusatGudang = await makePayable(pusat, gudang, 200_000, new Date('2026-10-14T10:00:00+07:00'))
  // Shift Toko A 25 Okt terverifikasi Rp400.000 (cara lama) + satu shift belum terverifikasi (tidak dipakai).
  await db.insert(shifts).values([
    {
      branchId: tokoA, openedById: ownerId, shiftNumber: 900, assignedCashiers: [ownerId], openingCash: 0, status: 'CLOSED',
      origin: 'POS', closedAt: new Date('2026-10-25T10:00:00Z'), totalClosingCashReal: 410_000, totalClosingCashExpected: 410_000,
      depositReceivedCash: 400_000, depositVerifiedAt: new Date('2026-10-25T12:00:00Z'), depositVerifiedById: ownerId,
    },
    {
      branchId: tokoA, openedById: ownerId, shiftNumber: 901, assignedCashiers: [ownerId], openingCash: 0, status: 'CLOSED',
      origin: 'POS', closedAt: new Date('2026-10-26T10:00:00Z'), totalClosingCashReal: 900_000, totalClosingCashExpected: 900_000,
    },
  ])
})

describe('Pelunasan susulan utang lama (DB lokal)', () => {
  it('jalankan = hasil pratinjau: berantai Toko A → Pusat → Gudang, baris SUSULAN; tidak bisa dua kali; batal membalik', async () => {
    const totals = await preview()
    expect(totals.fingerprint).toContain(`${aPusat}:300000`)
    expect(totals.fingerprint).toContain(`${pusatGudang}:200000`)

    await expect(runLegacySettlement({
      fromDate: FROM, ...options, confirmTotal: totals.settled, expectedFingerprint: `${totals.fingerprint},0:1`, notes: 'tes basi', userId: ownerId,
    })).rejects.toMatchObject({ code: 'STALE' })
    await expect(runLegacySettlement({
      fromDate: FROM, ...options, confirmTotal: totals.settled + 1, expectedFingerprint: totals.fingerprint, notes: 'tes salah ketik', userId: ownerId,
    })).rejects.toBeInstanceOf(DepositError)

    const result = await runLegacySettlement({
      fromDate: FROM, ...options, confirmTotal: totals.settled, expectedFingerprint: totals.fingerprint, notes: 'tes jalankan', userId: ownerId,
    })
    expect(result.settled).toBe(totals.settled)
    expect(await payable(aPusat)).toMatchObject({ paidAmount: 300_000, status: 'PAID' })
    expect(await payable(pusatGudang)).toMatchObject({ paidAmount: 200_000, status: 'PAID' })
    const pays = await db.select().from(interBranchPayments)
      .where(inArray(interBranchPayments.payableId, [aPusat, pusatGudang])).orderBy(asc(interBranchPayments.id))
    expect(pays.map((p) => [p.sourceType, p.amount, p.referenceNumber])).toEqual([
      ['SUSULAN', 300_000, result.reference], ['SUSULAN', 200_000, result.reference],
    ])
    const rows = await db.select().from(depositSettlements)
      .where(and(eq(depositSettlements.sourceType, 'LEGACY_RUN'), eq(depositSettlements.sourceId, result.runId)))
    expect(rows.filter((r) => r.payableId === aPusat)[0]).toMatchObject({ level: 1, payerBranchId: tokoA, amount: 300_000 })
    expect(rows.filter((r) => r.payableId === pusatGudang)[0]).toMatchObject({ level: 2, payerBranchId: pusat, amount: 200_000 })

    await expect(runLegacySettlement({
      fromDate: FROM, ...options, confirmTotal: 1, expectedFingerprint: 'x', notes: 'tes dua kali', userId: ownerId,
    })).rejects.toMatchObject({ status: 409 })

    const cancelled = await cancelLegacyRun({ runId: result.runId, reason: 'tes batalkan', userId: ownerId })
    expect(cancelled.reversed).toBeGreaterThanOrEqual(2)
    expect(await payable(aPusat)).toMatchObject({ paidAmount: 0, status: 'UNPAID' })
    expect(await payable(pusatGudang)).toMatchObject({ paidAmount: 0, status: 'UNPAID' })
    const after = await db.select().from(interBranchPayments)
      .where(inArray(interBranchPayments.payableId, [aPusat, pusatGudang])).orderBy(asc(interBranchPayments.id))
    expect(after.map((p) => [p.sourceType, p.amount])).toEqual([
      ['SUSULAN', 300_000], ['SUSULAN', 200_000], ['BATAL_SUSULAN', -300_000], ['BATAL_SUSULAN', -200_000],
    ])
    const [r] = await db.select().from(legacySettlementRuns).where(eq(legacySettlementRuns.id, result.runId))
    expect(r).toMatchObject({ status: 'CANCELLED', cancelReason: 'tes batalkan' })
    await expect(cancelLegacyRun({ runId: result.runId, reason: 'tes ulang', userId: ownerId })).rejects.toMatchObject({ status: 409 })

    // Sesudah batal, pratinjau sama lagi dan bisa dijalankan ulang; dibatalkan lagi agar DB lokal bersih.
    const again = await preview()
    expect(again.fingerprint).toBe(totals.fingerprint)
    const rerun = await runLegacySettlement({
      fromDate: FROM, ...options, confirmTotal: again.settled, expectedFingerprint: again.fingerprint, notes: 'tes jalankan ulang', userId: ownerId,
    })
    await cancelLegacyRun({ runId: rerun.runId, reason: 'bersihkan tes', userId: ownerId })
  })
})
