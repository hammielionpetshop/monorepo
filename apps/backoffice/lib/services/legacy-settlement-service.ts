import { db, sql, legacySettlementRuns, eq } from '../db'
import { getAutoSettlementSettings, listSettlementLines, type SettlementLine } from './deposit-settlement-service'

type Executor = Pick<typeof db, 'select' | 'execute'>

// F2-3b-1 Pratinjau utang lama — hanya membaca (spec docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md §3).
// "Lama" = lahir sebelum tanggal mulai pelunasan otomatis (`auto_settlement_settings.startDate`).

const wibDate = (col: ReturnType<typeof sql>) =>
  sql`to_char(${col} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`

export interface LegacyPayableRow {
  id: number
  transferId: number
  ibtNumber: string | null
  debtorBranchId: number
  creditorBranchId: number
  bornDate: string
  totalAmount: number
  paidAmount: number
  remaining: number
}

export interface LegacyShiftRow {
  id: number
  branchId: number
  shiftNumber: number
  closedDate: string
  verified: boolean
  /** Uang yang diketik Finance (terverifikasi) atau angka kasir/sistem (belum terverifikasi). */
  cash: number
  noncash: number
}

export interface LegacyManualPaymentRow {
  id: number
  payableId: number
  ibtNumber: string | null
  debtorBranchId: number
  creditorBranchId: number
  amount: number
  paidDate: string
  methodName: string | null
  paidByName: string | null
}

export interface LegacyRunInfo {
  id: number
  fromDate: string
  cutoffDate: string
  includeNoncash: boolean
  subtractManual: boolean
  settledAmount: number
  payablesCount: number
  freeAmount: number
  notes: string
  createdAt: string
  createdByName: string | null
  lines: SettlementLine[]
}

export interface LegacyCancelledRun {
  id: number
  fromDate: string
  settledAmount: number
  createdAt: string
  cancelledAt: string
  cancelledByName: string | null
  cancelReason: string | null
}

export interface LegacyPreviewData {
  /** Pelaksanaan pelunasan susulan yang sedang berlaku (paling banyak satu). */
  activeRun: LegacyRunInfo | null
  cancelledRuns: LegacyCancelledRun[]
  cutoffDate: string
  fromDate: string
  branches: { id: number; name: string }[]
  payables: LegacyPayableRow[]
  shifts: LegacyShiftRow[]
  manualPayments: LegacyManualPaymentRow[]
}

const rows = (r: unknown) => r as Record<string, unknown>[]

export async function loadLegacyPreviewData(fromDate: string, executor: Executor = db): Promise<LegacyPreviewData> {
  const { startDate: cutoffDate } = await getAutoSettlementSettings(executor)

  const [branchRows, payableRows, shiftRows, manualRows] = await Promise.all([
    executor.execute(sql`SELECT id, name FROM petshop.branches ORDER BY id`),
    executor.execute(sql`
      SELECT p.id, p.transfer_id, t.ibt_number, p.debtor_branch_id, p.creditor_branch_id,
        ${wibDate(sql`p.created_at`)} AS born_date, p.total_amount, p.paid_amount,
        p.total_amount - p.paid_amount AS remaining
      FROM petshop.inter_branch_payables p
      LEFT JOIN petshop.inter_branch_transfers t ON t.id = p.transfer_id
      WHERE p.status IN ('UNPAID', 'PARTIAL') AND p.total_amount > p.paid_amount
        AND ${wibDate(sql`p.created_at`)} < ${cutoffDate}
      ORDER BY p.created_at, p.id
    `),
    // Shift laci kasir yang ditutup di jendela [tanggal mulai X, tanggal mulai pelunasan otomatis).
    // Shift Back Office tidak punya laci, jadi tidak punya setoran.
    executor.execute(sql`
      SELECT s.id, s.branch_id, s.shift_number,
        ${wibDate(sql`COALESCE(s.closed_at, s.force_closed_at)`)} AS closed_date,
        s.deposit_verified_at IS NOT NULL AS verified,
        CASE WHEN s.deposit_verified_at IS NOT NULL THEN COALESCE(s.deposit_received_cash, 0)
             ELSE COALESCE(s.total_closing_cash_real, s.total_closing_cash_expected, 0) END AS cash,
        COALESCE((SELECT SUM(b.total_sales_qris + b.total_sales_debit + b.total_sales_credit)
                  FROM petshop.shift_cashier_breakdown b WHERE b.shift_id = s.id), 0) AS noncash
      FROM petshop.shifts s
      WHERE s.status <> 'OPEN' AND s.origin <> 'BACKOFFICE'
        AND ${wibDate(sql`COALESCE(s.closed_at, s.force_closed_at)`)} >= ${fromDate}
        AND ${wibDate(sql`COALESCE(s.closed_at, s.force_closed_at)`)} < ${cutoffDate}
      ORDER BY COALESCE(s.closed_at, s.force_closed_at), s.id
    `),
    // Pelunasan manual (diketik orang, `source_type` kosong) atas utang lama sejak X — dianggap memakai
    // uang setoran yang sama, termasuk atas utang yang sekarang sudah lunas.
    executor.execute(sql`
      SELECT x.id, x.payable_id, t.ibt_number, p.debtor_branch_id, p.creditor_branch_id, x.amount,
        ${wibDate(sql`x.paid_at`)} AS paid_date, m.name AS method_name, u.name AS paid_by_name
      FROM petshop.inter_branch_payments x
      JOIN petshop.inter_branch_payables p ON p.id = x.payable_id
      LEFT JOIN petshop.inter_branch_transfers t ON t.id = p.transfer_id
      LEFT JOIN petshop.payment_methods m ON m.id = x.payment_method_id
      LEFT JOIN petshop.users u ON u.id = x.paid_by_user_id
      WHERE x.source_type IS NULL
        AND ${wibDate(sql`p.created_at`)} < ${cutoffDate}
        AND ${wibDate(sql`x.paid_at`)} >= ${fromDate}
      ORDER BY x.paid_at, x.id
    `),
  ])

  return {
    activeRun: null,
    cancelledRuns: [],
    cutoffDate,
    fromDate,
    branches: rows(branchRows).map((r) => ({ id: Number(r.id), name: String(r.name) })),
    payables: rows(payableRows).map((r) => ({
      id: Number(r.id),
      transferId: Number(r.transfer_id),
      ibtNumber: (r.ibt_number as string | null) ?? null,
      debtorBranchId: Number(r.debtor_branch_id),
      creditorBranchId: Number(r.creditor_branch_id),
      bornDate: String(r.born_date),
      totalAmount: Number(r.total_amount),
      paidAmount: Number(r.paid_amount),
      remaining: Number(r.remaining),
    })),
    shifts: rows(shiftRows).map((r) => ({
      id: Number(r.id),
      branchId: Number(r.branch_id),
      shiftNumber: Number(r.shift_number),
      closedDate: String(r.closed_date),
      verified: r.verified === true || r.verified === 't',
      cash: Number(r.cash),
      noncash: Number(r.noncash),
    })),
    manualPayments: rows(manualRows).map((r) => ({
      id: Number(r.id),
      payableId: Number(r.payable_id),
      ibtNumber: (r.ibt_number as string | null) ?? null,
      debtorBranchId: Number(r.debtor_branch_id),
      creditorBranchId: Number(r.creditor_branch_id),
      amount: Number(r.amount),
      paidDate: String(r.paid_date),
      methodName: (r.method_name as string | null) ?? null,
      paidByName: (r.paid_by_name as string | null) ?? null,
    })),
  }
}

/** Pelaksanaan aktif + riwayat batal, untuk layar Utang Lama (F2-3b-2). */
export async function loadLegacyRuns(executor: Executor = db): Promise<Pick<LegacyPreviewData, 'activeRun' | 'cancelledRuns'>> {
  const runRows = rows(await executor.execute(sql`
    SELECT r.id, r.status, r.include_noncash, r.subtract_manual, r.settled_amount, r.payables_count,
      r.free_amount, r.notes, r.cancel_reason,
      to_char(r.from_date, 'YYYY-MM-DD') AS from_date, to_char(r.cutoff_date, 'YYYY-MM-DD') AS cutoff_date,
      to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      to_char(r.cancelled_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS cancelled_at,
      cu.name AS created_by_name, xu.name AS cancelled_by_name
    FROM petshop.legacy_settlement_runs r
    LEFT JOIN petshop.users cu ON cu.id = r.created_by
    LEFT JOIN petshop.users xu ON xu.id = r.cancelled_by
    ORDER BY r.id DESC
    LIMIT 20
  `))
  const active = runRows.find((r) => r.status === 'ACTIVE')
  let activeRun: LegacyRunInfo | null = null
  if (active) {
    const id = Number(active.id)
    const lines = (await listSettlementLines([{ sourceType: 'LEGACY_RUN', sourceId: id }], executor)).get(`LEGACY_RUN:${id}`) ?? []
    activeRun = {
      id,
      fromDate: String(active.from_date),
      cutoffDate: String(active.cutoff_date),
      includeNoncash: active.include_noncash === true || active.include_noncash === 't',
      subtractManual: active.subtract_manual === true || active.subtract_manual === 't',
      settledAmount: Number(active.settled_amount),
      payablesCount: Number(active.payables_count),
      freeAmount: Number(active.free_amount),
      notes: String(active.notes),
      createdAt: String(active.created_at),
      createdByName: (active.created_by_name as string | null) ?? null,
      lines,
    }
  }
  const cancelledRuns = runRows.filter((r) => r.status === 'CANCELLED').map((r): LegacyCancelledRun => ({
    id: Number(r.id),
    fromDate: String(r.from_date),
    settledAmount: Number(r.settled_amount),
    createdAt: String(r.created_at),
    cancelledAt: String(r.cancelled_at),
    cancelledByName: (r.cancelled_by_name as string | null) ?? null,
    cancelReason: (r.cancel_reason as string | null) ?? null,
  }))
  return { activeRun, cancelledRuns }
}

export async function hasActiveLegacyRun(executor: Executor = db): Promise<boolean> {
  const [row] = await executor.select({ id: legacySettlementRuns.id }).from(legacySettlementRuns)
    .where(eq(legacySettlementRuns.status, 'ACTIVE')).limit(1)
  return !!row
}
