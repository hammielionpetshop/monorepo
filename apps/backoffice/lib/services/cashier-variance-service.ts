import { db, appSettings, auditLogs, eq, sql } from '@/lib/db'
import {
  CASHIER_VARIANCE_SETTING_KEY,
  allocateByCashShare,
  classifyVariance,
  monthRange,
  nameKey,
  parseCashierVarianceSettings,
  recapByCashier,
  validateCashierVarianceSettings,
  type CashierRecap,
  type CashierVarianceSettings,
  type VarianceCategory,
} from '@/lib/cashier-variance'

type Executor = Pick<typeof db, 'select'>

export async function getCashierVarianceSettings(executor: Executor = db): Promise<CashierVarianceSettings> {
  const [row] = await executor
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, CASHIER_VARIANCE_SETTING_KEY))
    .limit(1)
  return parseCashierVarianceSettings(row?.value)
}

export class CashierVarianceSettingError extends Error {}

/** Ubah toleransi & batas tak wajar (Owner/GM). Berjejak di audit_logs. */
export async function setCashierVarianceSettings(
  next: CashierVarianceSettings,
  actor: { userId: number; branchId: number },
): Promise<CashierVarianceSettings> {
  const problem = validateCashierVarianceSettings(next)
  if (problem) throw new CashierVarianceSettingError(problem)
  const value = JSON.stringify({ tolerance: next.tolerance, anomalyThreshold: next.anomalyThreshold })
  return db.transaction(async (tx) => {
    const old = await getCashierVarianceSettings(tx)
    await tx
      .insert(appSettings)
      .values({ key: CASHIER_VARIANCE_SETTING_KEY, value, updatedBy: actor.userId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actor.userId, updatedAt: new Date() } })
    await tx.insert(auditLogs).values({
      branchId: actor.branchId,
      userId: actor.userId,
      action: 'CASHIER_VARIANCE_SETTINGS_UPDATE',
      tableName: 'app_settings',
      recordId: CASHIER_VARIANCE_SETTING_KEY,
      oldData: JSON.stringify(old),
      newData: value,
    })
    return next
  })
}

export interface VarianceAllocationView {
  cashierId: number
  cashierName: string
  cash: number
  sharePct: number
  amount: number
}

export interface VarianceShiftView {
  shiftId: number
  shiftNumber: number
  branchName: string
  /** Tanggal buka shift, WIB, 'YYYY-MM-DD'. */
  date: string
  status: string
  expectedCash: number | null
  receivedCash: number
  variance: number | null
  category: VarianceCategory
  depositNotes: string | null
  verifiedByName: string | null
  /** Pembagian ke kasir; kosong bila kategori tidak dibebankan atau tak ada kas tunai. */
  allocations: VarianceAllocationView[]
  /** Kas tunai per kasir (untuk tampilan porsi walau tidak dibebankan). */
  shares: VarianceAllocationView[]
}

export interface UnverifiedShiftView {
  shiftId: number
  shiftNumber: number
  branchName: string
  date: string
  status: string
}

export interface CashierRecapView extends CashierRecap {
  cashierName: string
  /** Username akun-akun yang digabung ke nama ini (lebih dari satu = orang yang sama beda cabang). */
  accounts: string[]
}

export interface CashierVarianceReport {
  month: string
  settings: CashierVarianceSettings
  shifts: VarianceShiftView[]
  unverified: UnverifiedShiftView[]
  cashiers: CashierRecapView[]
  totals: {
    minus: number
    plus: number
    minusShiftCount: number
    plusShiftCount: number
    toleratedShiftCount: number
    matchShiftCount: number
    anomalyShiftCount: number
    /** Selisih minus/plus yang tak bisa dibagi karena shift tanpa kas tunai. */
    unallocated: number
  }
}

/**
 * Laporan Minus Kasir satu bulan (berdasarkan tanggal buka shift WIB). Hanya shift POS
 * yang sudah tutup; yang belum diverifikasi finance dilaporkan terpisah tanpa angka resmi.
 * `branchId` null = semua cabang (pemanggil sudah memastikan cakupan cabang pengguna).
 */
export async function getCashierVarianceReport(params: {
  month: string
  branchId: number | null
}): Promise<CashierVarianceReport | null> {
  const range = monthRange(params.month)
  if (!range) return null
  const settings = await getCashierVarianceSettings()

  const branchFilter = params.branchId != null ? sql`AND s.branch_id = ${params.branchId}` : sql``
  const shiftRows = (await db.execute(sql`
    SELECT s.id, s.shift_number, s.status, b.name AS branch_name,
      to_char(s.opened_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS date,
      s.total_closing_cash_expected AS expected_cash,
      s.deposit_received_cash AS received_cash,
      s.deposit_verified_at IS NOT NULL AS verified,
      s.deposit_notes, vu.name AS verified_by_name
    FROM petshop.shifts s
    JOIN petshop.branches b ON b.id = s.branch_id
    LEFT JOIN petshop.users vu ON vu.id = s.deposit_verified_by_id
    WHERE s.origin = 'POS'
      AND s.status IN ('CLOSED', 'FORCE_CLOSED')
      AND s.opened_at >= ((${range.start}::date)::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'
      AND s.opened_at <  ((${range.end}::date)::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'
      ${branchFilter}
    ORDER BY s.opened_at, s.id
  `)) as Record<string, unknown>[]

  const verifiedRows = shiftRows.filter((r) => r.verified === true)
  const verifiedIds = verifiedRows.map((r) => Number(r.id))

  // Kas tunai per kasir = penjualan tunai bersih kembalian (breakdown settle/tutup paksa)
  // + pelunasan piutang tunai yang ia terima di shift itu (belum di-void).
  const idList = sql`(${sql.join(verifiedIds.map((id) => sql`${id}`), sql`, `)})`
  const shareRows = verifiedIds.length
    ? ((await db.execute(sql`
        WITH cash AS (
          SELECT scb.shift_id, scb.cashier_id, scb.total_sales_cash::bigint AS amount
          FROM petshop.shift_cashier_breakdown scb
          WHERE scb.shift_id IN ${idList}
          UNION ALL
          SELECT dp.shift_id, dp.created_by AS cashier_id, SUM(dp.amount)::bigint AS amount
          FROM petshop.debt_payments dp
          JOIN petshop.payment_methods pm ON pm.id = dp.payment_method_id
          WHERE dp.shift_id IN ${idList}
            AND dp.voided_at IS NULL AND pm.type = 'CASH' AND dp.created_by IS NOT NULL
          GROUP BY dp.shift_id, dp.created_by
        )
        SELECT c.shift_id, c.cashier_id, u.name AS cashier_name, u.username, SUM(c.amount)::bigint AS cash
        FROM cash c JOIN petshop.users u ON u.id = c.cashier_id
        GROUP BY c.shift_id, c.cashier_id, u.name, u.username
        ORDER BY c.shift_id, cash DESC
      `)) as Record<string, unknown>[])
    : []

  const names = new Map<number, string>()
  const usernames = new Map<number, string>()
  const sharesByShift = new Map<number, { cashierId: number; cash: number }[]>()
  for (const r of shareRows) {
    const shiftId = Number(r.shift_id)
    const cashierId = Number(r.cashier_id)
    names.set(cashierId, String(r.cashier_name))
    usernames.set(cashierId, r.username != null ? String(r.username) : `#${cashierId}`)
    const list = sharesByShift.get(shiftId) ?? []
    list.push({ cashierId, cash: Number(r.cash) })
    sharesByShift.set(shiftId, list)
  }

  const totals: CashierVarianceReport['totals'] = {
    minus: 0, plus: 0, minusShiftCount: 0, plusShiftCount: 0,
    toleratedShiftCount: 0, matchShiftCount: 0, anomalyShiftCount: 0, unallocated: 0,
  }

  const toView = (list: { cashierId: number; cash: number; sharePct: number; amount: number }[]) =>
    list.map((a) => ({ ...a, cashierName: names.get(a.cashierId) ?? `#${a.cashierId}` }))

  const shifts: VarianceShiftView[] = verifiedRows.map((r) => {
    const shiftId = Number(r.id)
    const expectedCash = r.expected_cash != null ? Number(r.expected_cash) : null
    const receivedCash = Number(r.received_cash ?? 0)
    const variance = expectedCash != null ? receivedCash - expectedCash : null
    const category = classifyVariance(variance, settings)
    const shares = sharesByShift.get(shiftId) ?? []
    const shareView = allocateByCashShare(0, shares)
    const charged = category === 'MINUS' || category === 'PLUS'
    const allocations = charged ? allocateByCashShare(variance as number, shares) : []

    if (category === 'MINUS') { totals.minus += variance as number; totals.minusShiftCount += 1 }
    if (category === 'PLUS') { totals.plus += variance as number; totals.plusShiftCount += 1 }
    if (category === 'TOLERATED') totals.toleratedShiftCount += 1
    if (category === 'MATCH') totals.matchShiftCount += 1
    if (category === 'ANOMALY') totals.anomalyShiftCount += 1
    if (charged && allocations.length === 0) totals.unallocated += variance as number

    return {
      shiftId,
      shiftNumber: Number(r.shift_number),
      branchName: String(r.branch_name),
      date: String(r.date),
      status: String(r.status),
      expectedCash,
      receivedCash,
      variance,
      category,
      depositNotes: r.deposit_notes != null && String(r.deposit_notes).trim() ? String(r.deposit_notes) : null,
      verifiedByName: r.verified_by_name != null ? String(r.verified_by_name) : null,
      allocations: toView(allocations),
      shares: toView(shareView),
    }
  })

  const recap = recapByCashier(
    shifts.map((s) => ({ shiftId: s.shiftId, variance: s.variance, shares: sharesByShift.get(s.shiftId) ?? [] })),
    settings,
    // Satu orang bisa punya akun per cabang (mis. "rizal" & "rizalpusat") — rekap digabung per nama.
    (id) => nameKey(names.get(id) ?? `#${id}`),
  )

  return {
    month: params.month,
    settings,
    shifts,
    unverified: shiftRows
      .filter((r) => r.verified !== true)
      .map((r) => ({
        shiftId: Number(r.id),
        shiftNumber: Number(r.shift_number),
        branchName: String(r.branch_name),
        date: String(r.date),
        status: String(r.status),
      })),
    cashiers: recap.map((c) => ({
      ...c,
      cashierName: names.get(c.cashierIds[0]) ?? c.key,
      accounts: c.cashierIds.map((id) => usernames.get(id) ?? `#${id}`).sort(),
    })),
    totals,
  }
}
