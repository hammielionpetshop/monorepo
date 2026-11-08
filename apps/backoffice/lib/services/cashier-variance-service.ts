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
import { shiftSettleVariance } from './deposit-rules'

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
      s.total_closing_cash_expected AS expected_cash, s.total_closing_cash_real AS real_cash, s.origin,
      s.deposit_received_cash AS received_cash,
      -- Cara lama (sebelum F2-2): angka Finance di kolom shift. Cara baru: setoran tunai terverifikasi.
      s.deposit_verified_at IS NOT NULL AS legacy_verified,
      cd.id AS deposit_id, cd.deposit_number, cd.notes AS deposit_notes_new, dvu.name AS deposit_verified_by_name,
      s.deposit_notes, vu.name AS verified_by_name
    FROM petshop.shifts s
    JOIN petshop.branches b ON b.id = s.branch_id
    LEFT JOIN petshop.users vu ON vu.id = s.deposit_verified_by_id
    LEFT JOIN petshop.cash_deposit_shifts cds ON cds.shift_id = s.id AND cds.released_at IS NULL
    LEFT JOIN petshop.cash_deposits cd ON cd.id = cds.deposit_id AND cd.status = 'VERIFIED'
    LEFT JOIN petshop.users dvu ON dvu.id = cd.verified_by
    WHERE s.origin = 'POS'
      AND s.status IN ('CLOSED', 'FORCE_CLOSED')
      AND s.opened_at >= ((${range.start}::date)::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'
      AND s.opened_at <  ((${range.end}::date)::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'
      ${branchFilter}
    ORDER BY s.opened_at, s.id
  `)) as Record<string, unknown>[]

  for (const r of shiftRows) {
    r.mode = r.legacy_verified === true ? 'LEGACY' : r.deposit_id != null ? 'DEPOSIT' : null
    r.verified = r.mode != null
  }
  const verifiedRows = shiftRows.filter((r) => r.verified === true)
  const verifiedIds = verifiedRows.map((r) => Number(r.id))
  const depositIds = verifiedRows.filter((r) => r.mode === 'DEPOSIT').map((r) => Number(r.id))

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

  // Alur Setoran (F2-2): sebab selisih yang dibebankan ke kasir tertentu. Biaya bank & Lainnya tidak masuk.
  const depositIdList = sql`(${sql.join(depositIds.map((id) => sql`${id}`), sql`, `)})`
  const chargeRows = depositIds.length
    ? ((await db.execute(sql`
        SELECT v.shift_id, v.cashier_id, v.amount::bigint AS amount, u.name AS cashier_name, u.username
        FROM petshop.cash_deposit_variances v
        JOIN petshop.cash_deposit_shifts ds ON ds.deposit_id = v.deposit_id AND ds.shift_id = v.shift_id AND ds.released_at IS NULL
        JOIN petshop.cash_deposits d ON d.id = v.deposit_id AND d.status = 'VERIFIED'
        JOIN petshop.users u ON u.id = v.cashier_id
        WHERE v.shift_id IN ${depositIdList} AND v.cause IN ('CASHIER_SHORT', 'CASHIER_OVER')
        UNION ALL
        SELECT nv.shift_id, nv.cashier_id, nv.variance::bigint, u.name, u.username
        FROM petshop.noncash_verifications nv
        LEFT JOIN petshop.users u ON u.id = nv.cashier_id
        WHERE nv.shift_id IN ${depositIdList} AND nv.superseded_at IS NULL AND nv.status = 'VERIFIED'
          AND nv.cause = 'CASHIER_INPUT' AND nv.variance <> 0
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

  const chargesByShift = new Map<number, { cashierId: number | null; amount: number }[]>()
  for (const r of chargeRows) {
    const shiftId = Number(r.shift_id)
    const cashierId = r.cashier_id != null ? Number(r.cashier_id) : null
    if (cashierId != null) {
      names.set(cashierId, String(r.cashier_name))
      usernames.set(cashierId, r.username != null ? String(r.username) : `#${cashierId}`)
    }
    const list = chargesByShift.get(shiftId) ?? []
    list.push({ cashierId, amount: Number(r.amount) })
    chargesByShift.set(shiftId, list)
  }

  // Pembagian per shift yang dipakai tampilan & rekap (null = bagi porsi kas seperti biasa).
  const fixedAllocations = new Map<number, { cashierId: number; amount: number }[]>()

  const shifts: VarianceShiftView[] = verifiedRows.map((r) => {
    const shiftId = Number(r.id)
    const expectedCash = r.expected_cash != null ? Number(r.expected_cash) : null
    const shares = sharesByShift.get(shiftId) ?? []
    const shareView = allocateByCashShare(0, shares)

    let receivedCash: number
    let variance: number | null
    let allocations: ReturnType<typeof allocateByCashShare> = []
    let unallocated = 0
    let depositNotes: string | null
    let verifiedByName: string | null

    if (r.mode === 'DEPOSIT') {
      // Selisih resmi = selisih tutup shift (hitungan − sistem, dibagi porsi kas)
      //   + sebab Setoran yang dibebankan Finance ke kasir tertentu (atau porsi kas bila kasir tak dipilih).
      const settle = shiftSettleVariance({
        origin: String(r.origin),
        status: String(r.status),
        totalClosingCashReal: r.real_cash != null ? Number(r.real_cash) : null,
        totalClosingCashExpected: expectedCash,
      })
      const charges = chargesByShift.get(shiftId) ?? []
      const shared = settle + charges.filter((c) => c.cashierId == null).reduce((sum, c) => sum + c.amount, 0)
      const direct = new Map<number, number>()
      for (const c of charges) if (c.cashierId != null) direct.set(c.cashierId, (direct.get(c.cashierId) ?? 0) + c.amount)
      variance = shared + [...direct.values()].reduce((a, b) => a + b, 0)
      receivedCash = (expectedCash ?? 0) + variance

      const sharedPart = shared !== 0 ? allocateByCashShare(shared, shares) : []
      if (shared !== 0 && sharedPart.length === 0) unallocated = shared
      const merged = new Map<number, number>()
      for (const a of sharedPart) merged.set(a.cashierId, (merged.get(a.cashierId) ?? 0) + a.amount)
      for (const [id, amount] of direct) merged.set(id, (merged.get(id) ?? 0) + amount)
      const byShare = new Map(shareView.map((x) => [x.cashierId, x]))
      allocations = [...merged.entries()]
        .filter(([, amount]) => amount !== 0)
        .map(([cashierId, amount]) => ({ cashierId, amount, cash: byShare.get(cashierId)?.cash ?? 0, sharePct: byShare.get(cashierId)?.sharePct ?? 0 }))
      fixedAllocations.set(shiftId, allocations.map((a) => ({ cashierId: a.cashierId, amount: a.amount })))
      const note = r.deposit_notes_new != null && String(r.deposit_notes_new).trim() ? ` — ${String(r.deposit_notes_new)}` : ''
      depositNotes = `Setoran ${String(r.deposit_number)}${note}`
      verifiedByName = r.deposit_verified_by_name != null ? String(r.deposit_verified_by_name) : null
    } else {
      receivedCash = Number(r.received_cash ?? 0)
      variance = expectedCash != null ? receivedCash - expectedCash : null
      depositNotes = r.deposit_notes != null && String(r.deposit_notes).trim() ? String(r.deposit_notes) : null
      verifiedByName = r.verified_by_name != null ? String(r.verified_by_name) : null
    }

    const category = classifyVariance(variance, settings)
    const charged = category === 'MINUS' || category === 'PLUS'
    if (r.mode !== 'DEPOSIT') {
      allocations = charged ? allocateByCashShare(variance as number, shares) : []
      if (charged && allocations.length === 0) unallocated = variance as number
    } else if (!charged) {
      allocations = []
      unallocated = 0
    }

    if (category === 'MINUS') { totals.minus += variance as number; totals.minusShiftCount += 1 }
    if (category === 'PLUS') { totals.plus += variance as number; totals.plusShiftCount += 1 }
    if (category === 'TOLERATED') totals.toleratedShiftCount += 1
    if (category === 'MATCH') totals.matchShiftCount += 1
    if (category === 'ANOMALY') totals.anomalyShiftCount += 1
    totals.unallocated += unallocated

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
      depositNotes,
      verifiedByName,
      allocations: toView(allocations),
      shares: toView(shareView),
    }
  })

  const recap = recapByCashier(
    shifts.map((s) => ({
      shiftId: s.shiftId,
      branchName: s.branchName,
      variance: s.variance,
      shares: sharesByShift.get(s.shiftId) ?? [],
      allocations: fixedAllocations.get(s.shiftId),
    })),
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
