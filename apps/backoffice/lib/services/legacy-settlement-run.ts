import { db, legacySettlementRuns, eq, and, sql } from '../db'
import { DepositError } from './deposit-error'
import { getAutoSettlementSettings, lockSettlement, reverseSettlements, writeSettlementSteps } from './deposit-settlement-service'
import { simulateLegacySettlement, simulationTotals, summarizeBranchMoney, type LegacyOptions } from './legacy-settlement-rules'
import { hasActiveLegacyRun, loadLegacyPreviewData } from './legacy-settlement-service'

// F2-3b-2 Jalankan / Batalkan pelunasan susulan utang lama (spec
// docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md §4). Hitungan diulang di server dengan
// aturan yang sama persis dengan layar Pratinjau; bila berbeda dari yang dilihat Owner, ditolak.
// Bukan uang kas baru — tanpa catatan Pendapatan & Pengeluaran (sama dengan F2-3).

export const LEGACY_PAYMENT_SOURCE = 'SUSULAN'
export const LEGACY_REVERSAL_SOURCE = 'BATAL_SUSULAN'

export const legacyRunReference = (runId: number) => `SUSULAN-${runId}`

export interface LegacyRunInput extends LegacyOptions {
  fromDate: string
  /** Total Rp dilunasi yang diketik ulang Owner (harus sama dengan hitungan). */
  confirmTotal: number
  /** Sidik hasil yang dilihat Owner di layar (`simulationTotals().fingerprint`). */
  expectedFingerprint: string
  notes: string
  userId: number
  now?: Date
}

export async function runLegacySettlement(input: LegacyRunInput) {
  return db.transaction(async (tx) => {
    // Kunci yang sama dengan pelunasan otomatis F2-3: tidak bentrok dengan verifikasi setoran.
    await lockSettlement(tx)
    if (await hasActiveLegacyRun(tx)) {
      throw new DepositError('Sudah ada pelunasan susulan yang berlaku. Batalkan dulu untuk menjalankan ulang dengan pilihan lain.', 409)
    }
    const { startDate: cutoffDate } = await getAutoSettlementSettings(tx)
    if (input.fromDate >= cutoffDate) throw new DepositError(`Tanggal mulai harus sebelum ${cutoffDate}`)
    // Kunci baris utang lama yang terbuka dulu, baru dibaca, supaya tidak berubah selama penulisan.
    await tx.execute(sql`
      SELECT p.id FROM petshop.inter_branch_payables p
      WHERE p.status IN ('UNPAID', 'PARTIAL') AND p.total_amount > p.paid_amount
        AND to_char(p.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') < ${cutoffDate}
      FOR UPDATE OF p
    `)
    const data = await loadLegacyPreviewData(input.fromDate, tx)

    const options: LegacyOptions = { includeNoncash: input.includeNoncash, subtractManual: input.subtractManual }
    const sim = simulateLegacySettlement(data.payables, summarizeBranchMoney(data), options)
    const totals = simulationTotals(sim)
    if (totals.settled <= 0) throw new DepositError('Tidak ada utang lama yang bisa dilunasi dengan pilihan ini.')
    if (totals.fingerprint !== input.expectedFingerprint) {
      throw new DepositError('Data berubah sejak halaman dibuka (utang atau setoran lama berubah). Muat ulang halaman dan periksa angkanya lagi.', 409, 'STALE')
    }
    if (input.confirmTotal !== totals.settled) {
      throw new DepositError(`Total yang diketik tidak sama dengan total dilunasi (Rp ${totals.settled.toLocaleString('id-ID')}).`)
    }

    const now = input.now ?? new Date()
    const [run] = await tx.insert(legacySettlementRuns).values({
      fromDate: input.fromDate,
      cutoffDate: data.cutoffDate,
      includeNoncash: input.includeNoncash,
      subtractManual: input.subtractManual,
      settledAmount: totals.settled,
      payablesCount: totals.payablesCount,
      freeAmount: totals.free,
      notes: input.notes,
      createdBy: input.userId,
      createdAt: now,
    }).returning({ id: legacySettlementRuns.id })

    const reference = legacyRunReference(run.id)
    await writeSettlementSteps(tx, sim.steps, {
      sourceType: 'LEGACY_RUN',
      sourceId: run.id,
      userId: input.userId,
      now,
      paymentSource: LEGACY_PAYMENT_SOURCE,
      reference,
      noteOf: (step, originName) =>
        `Pelunasan susulan utang lama ${reference} (setoran sejak ${input.fromDate})${step.level > 1 ? ` — diteruskan dari setoran ${originName}` : ''}`,
    })
    return { runId: run.id, reference, ...totals }
  })
}

export async function cancelLegacyRun(input: { runId: number; reason: string; userId: number; now?: Date }) {
  return db.transaction(async (tx) => {
    await lockSettlement(tx)
    const now = input.now ?? new Date()
    const [run] = await tx.update(legacySettlementRuns)
      .set({ status: 'CANCELLED', cancelledBy: input.userId, cancelledAt: now, cancelReason: input.reason })
      .where(and(eq(legacySettlementRuns.id, input.runId), eq(legacySettlementRuns.status, 'ACTIVE')))
      .returning({ id: legacySettlementRuns.id })
    if (!run) throw new DepositError('Pelunasan susulan ini tidak ditemukan atau sudah dibatalkan.', 409)
    const reference = legacyRunReference(run.id)
    const reversed = await reverseSettlements(tx, {
      sourceType: 'LEGACY_RUN',
      sourceId: run.id,
      reference,
      reason: input.reason,
      userId: input.userId,
      now,
      paymentSource: LEGACY_REVERSAL_SOURCE,
      notes: `Batal pelunasan susulan ${reference}: ${input.reason}`,
    })
    return { runId: run.id, reversed }
  })
}
