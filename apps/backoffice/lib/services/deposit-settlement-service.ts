import Big from 'big.js'
import {
  db, appSettings, branches, depositSettlements, interBranchPayables, interBranchPayments,
  eq, and, asc, inArray, isNull, sql,
} from '../db'
import { todayWibDate } from '../payment-date'
import { DepositError } from './deposit-error'
import {
  AUTO_SETTLEMENT_SETTINGS_KEY, parseAutoSettlementSettings, planSettlement,
  type AutoSettlementSettings, type OpenPayable,
} from './deposit-settlement-rules'

// F2-3 Pelunasan Otomatis — dipanggil di transaksi DB yang sama dengan Verifikasi Setoran (F2-2).
// Spec: docs/work/specs/2026-11-08-f2-3-pelunasan-otomatis-design.md. Tidak ada hapus/timpa:
// koreksi = baris pembalikan (`BATAL_SETORAN`, nominal negatif). Bukan uang kas baru — tanpa catatan
// Pendapatan & Pengeluaran (uangnya sudah tercatat pindah di `money_movements`).

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = Pick<typeof db, 'select' | 'execute'>
export type SettlementSource = 'CASH_DEPOSIT' | 'NONCASH_VERIFICATION'

export const SETTLEMENT_PAYMENT_SOURCE = 'SETORAN'
export const SETTLEMENT_REVERSAL_SOURCE = 'BATAL_SETORAN'

export async function getAutoSettlementSettings(executor: Executor = db): Promise<AutoSettlementSettings> {
  const [row] = await executor
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, AUTO_SETTLEMENT_SETTINGS_KEY))
    .limit(1)
  return parseAutoSettlementSettings(row?.value, todayWibDate())
}

function lockSettlement(tx: Tx) {
  // Satu penjaga untuk semua alokasi: dua verifikasi bersamaan tidak melunasi tagihan yang sama.
  return tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('deposit_settlement'))`)
}

function statusSql(paidExpr: ReturnType<typeof sql>) {
  return sql`CASE WHEN ${interBranchPayables.status} = 'WAIVED' THEN 'WAIVED'
    WHEN ${paidExpr} >= ${interBranchPayables.totalAmount} THEN 'PAID'
    WHEN ${paidExpr} > 0 THEN 'PARTIAL' ELSE 'UNPAID' END`
}

export interface SettlementSummary {
  /** Jumlah tagihan yang dilunasi (sebagian/penuh) di semua tingkat. */
  payablesSettled: number
  settledAmount: number
  /** Setoran bebas cabang penyetor (tingkat 1). */
  freeAmount: number
}

/**
 * Lunasi utang internal dari satu setoran terverifikasi (spec §2–§3). Hanya uang yang sampai di
 * Tempat Uang dipegang Finance; utang yang lahir sebelum tanggal mulai tidak disentuh (pilihan A).
 */
export async function settleFromVerifiedSource(
  tx: Tx,
  input: {
    sourceType: SettlementSource
    sourceId: number
    branchId: number
    amount: number
    heldBy: string
    reference: string
    userId: number
    now?: Date
  },
): Promise<SettlementSummary> {
  const empty = { payablesSettled: 0, settledAmount: 0, freeAmount: 0 }
  if (input.heldBy !== 'FINANCE' || input.amount <= 0) return empty
  await lockSettlement(tx)
  const settings = await getAutoSettlementSettings(tx)
  const now = input.now ?? new Date()

  const open = (await tx.execute(sql`
    SELECT p.id, p.debtor_branch_id, p.creditor_branch_id, p.total_amount - p.paid_amount AS remaining
    FROM petshop.inter_branch_payables p
    WHERE p.status IN ('UNPAID', 'PARTIAL') AND p.total_amount > p.paid_amount
      AND to_char(p.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') >= ${settings.startDate}
    ORDER BY p.created_at, p.id
    FOR UPDATE OF p
  `)) as Record<string, unknown>[]
  const byDebtor = new Map<number, OpenPayable[]>()
  for (const r of open) {
    const debtor = Number(r.debtor_branch_id)
    const list = byDebtor.get(debtor) ?? []
    list.push({ id: Number(r.id), creditorBranchId: Number(r.creditor_branch_id), remaining: Number(r.remaining) })
    byDebtor.set(debtor, list)
  }

  const steps = planSettlement(input.branchId, input.amount, (b) => byDebtor.get(b) ?? [])
  if (steps.length === 0) return empty

  const payerNames = new Map(
    (await tx.select({ id: branches.id, name: branches.name }).from(branches)
      .where(inArray(branches.id, [...new Set(steps.map((s) => s.payerBranchId))])))
      .map((b) => [b.id, b.name]),
  )
  const rowIds: number[] = []
  let settled = new Big(0)
  let free = new Big(0)
  let count = 0
  for (const step of steps) {
    let paymentId: number | null = null
    if (step.payableId != null) {
      const [updated] = await tx
        .update(interBranchPayables)
        .set({
          paidAmount: sql`${interBranchPayables.paidAmount} + ${step.amount}`,
          status: statusSql(sql`${interBranchPayables.paidAmount} + ${step.amount}`),
          updatedAt: now,
        })
        .where(and(
          eq(interBranchPayables.id, step.payableId),
          sql`${interBranchPayables.paidAmount} + ${step.amount} <= ${interBranchPayables.totalAmount}`,
        ))
        .returning({ id: interBranchPayables.id })
      if (!updated) throw new DepositError('Sisa utang internal berubah saat pelunasan otomatis — coba lagi', 409)
      const via = step.level > 1 ? ` (diteruskan dari setoran ${payerNames.get(input.branchId) ?? 'cabang'})` : ''
      const [payment] = await tx.insert(interBranchPayments).values({
        payableId: step.payableId,
        amount: step.amount,
        paidByUserId: input.userId,
        paymentMethodId: null,
        sourceType: SETTLEMENT_PAYMENT_SOURCE,
        referenceNumber: input.reference,
        notes: `Pelunasan otomatis dari setoran ${input.reference}${via}`.slice(0, 500),
        paidAt: now,
      }).returning({ id: interBranchPayments.id })
      paymentId = payment.id
      count += 1
      settled = settled.plus(step.amount)
    } else if (step.level === 1) {
      free = free.plus(step.amount)
    }
    const [row] = await tx.insert(depositSettlements).values({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      level: step.level,
      parentId: step.parent != null ? rowIds[step.parent] : null,
      payerBranchId: step.payerBranchId,
      payableId: step.payableId,
      paymentId,
      amount: step.amount,
      createdBy: input.userId,
      createdAt: now,
    }).returning({ id: depositSettlements.id })
    rowIds.push(row.id)
  }
  return { payablesSettled: count, settledAmount: Number(settled), freeAmount: Number(free) }
}

/**
 * Balik semua pelunasan dari satu setoran (termasuk rantainya) saat koreksi (spec §4): baris negatif,
 * `paid_amount` turun, status dihitung ulang; utang yang sementara itu dihapuskan tetap WAIVED.
 */
export async function reverseSettlements(
  tx: Tx,
  input: { sourceType: SettlementSource; sourceId: number; reference: string; reason: string; userId: number; now?: Date },
): Promise<number> {
  await lockSettlement(tx)
  const now = input.now ?? new Date()
  const rows = await tx
    .select()
    .from(depositSettlements)
    .where(and(
      eq(depositSettlements.sourceType, input.sourceType),
      eq(depositSettlements.sourceId, input.sourceId),
      isNull(depositSettlements.reversalOfId),
      sql`NOT EXISTS (SELECT 1 FROM petshop.deposit_settlements r WHERE r.reversal_of_id = ${depositSettlements.id})`,
    ))
    .orderBy(asc(depositSettlements.id))
  let reversed = 0
  for (const row of rows) {
    let paymentId: number | null = null
    if (row.payableId != null) {
      const [updated] = await tx
        .update(interBranchPayables)
        .set({
          paidAmount: sql`${interBranchPayables.paidAmount} - ${row.amount}`,
          status: statusSql(sql`${interBranchPayables.paidAmount} - ${row.amount}`),
          updatedAt: now,
        })
        .where(and(eq(interBranchPayables.id, row.payableId), sql`${interBranchPayables.paidAmount} >= ${row.amount}`))
        .returning({ id: interBranchPayables.id })
      if (!updated) {
        throw new DepositError('Pelunasan otomatis setoran ini tidak bisa dibalik karena utang internalnya sudah berubah (mis. Retur Internal). Hubungi Owner untuk koreksi manual.', 409)
      }
      const [payment] = await tx.insert(interBranchPayments).values({
        payableId: row.payableId,
        amount: -row.amount,
        paidByUserId: input.userId,
        paymentMethodId: null,
        sourceType: SETTLEMENT_REVERSAL_SOURCE,
        referenceNumber: input.reference,
        notes: `Batal pelunasan otomatis setoran ${input.reference}: ${input.reason}`.slice(0, 500),
        paidAt: now,
      }).returning({ id: interBranchPayments.id })
      paymentId = payment.id
      reversed += 1
    }
    await tx.insert(depositSettlements).values({
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      level: row.level,
      parentId: row.parentId,
      payerBranchId: row.payerBranchId,
      payableId: row.payableId,
      paymentId,
      amount: -row.amount,
      reversalOfId: row.id,
      createdBy: input.userId,
      createdAt: now,
    })
  }
  return reversed
}

export interface SettlementLine {
  id: number
  level: number
  parentId: number | null
  payerBranchName: string
  creditorBranchName: string | null
  ibtNumber: string | null
  amount: number
  /** true = baris pembalikan / sudah dibalik. */
  reversed: boolean
}

/** Rincian pelunasan per setoran untuk layar Setoran (spec §6.1). Kunci: `${sourceType}:${sourceId}`. */
export async function listSettlementLines(
  sources: { sourceType: SettlementSource; sourceId: number }[],
  executor: Executor = db,
): Promise<Map<string, SettlementLine[]>> {
  const result = new Map<string, SettlementLine[]>()
  if (sources.length === 0) return result
  const pairs = sql.join(sources.map((s) => sql`(${s.sourceType}, ${s.sourceId})`), sql`, `)
  const rows = (await executor.execute(sql`
    SELECT ds.id, ds.source_type, ds.source_id, ds.level, ds.parent_id, ds.amount,
      pb.name AS payer_name, cb.name AS creditor_name, t.ibt_number,
      EXISTS (SELECT 1 FROM petshop.deposit_settlements r WHERE r.reversal_of_id = ds.id) AS reversed
    FROM petshop.deposit_settlements ds
    JOIN petshop.branches pb ON pb.id = ds.payer_branch_id
    LEFT JOIN petshop.inter_branch_payables p ON p.id = ds.payable_id
    LEFT JOIN petshop.branches cb ON cb.id = p.creditor_branch_id
    LEFT JOIN petshop.inter_branch_transfers t ON t.id = p.transfer_id
    WHERE ds.reversal_of_id IS NULL AND (ds.source_type, ds.source_id) IN (${pairs})
    ORDER BY ds.id
  `)) as Record<string, unknown>[]
  for (const r of rows) {
    const key = `${r.source_type}:${r.source_id}`
    const list = result.get(key) ?? []
    list.push({
      id: Number(r.id),
      level: Number(r.level),
      parentId: r.parent_id != null ? Number(r.parent_id) : null,
      payerBranchName: String(r.payer_name),
      creditorBranchName: r.creditor_name != null ? String(r.creditor_name) : null,
      ibtNumber: r.ibt_number != null ? String(r.ibt_number) : null,
      amount: Number(r.amount),
      reversed: r.reversed === true,
    })
    result.set(key, list)
  }
  return result
}
