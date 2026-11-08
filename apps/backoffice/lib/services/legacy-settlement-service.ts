import { db, sql } from '../db'
import { getAutoSettlementSettings } from './deposit-settlement-service'

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

export interface LegacyPreviewData {
  cutoffDate: string
  fromDate: string
  branches: { id: number; name: string }[]
  payables: LegacyPayableRow[]
  shifts: LegacyShiftRow[]
  manualPayments: LegacyManualPaymentRow[]
}

const rows = (r: unknown) => r as Record<string, unknown>[]

export async function loadLegacyPreviewData(fromDate: string): Promise<LegacyPreviewData> {
  const { startDate: cutoffDate } = await getAutoSettlementSettings()

  const [branchRows, payableRows, shiftRows, manualRows] = await Promise.all([
    db.execute(sql`SELECT id, name FROM petshop.branches ORDER BY id`),
    db.execute(sql`
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
    db.execute(sql`
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
    db.execute(sql`
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
