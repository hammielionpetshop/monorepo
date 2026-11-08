import { db, sql } from '../db'
import { todayWibDate } from '../payment-date'
import { ageInDays, undepositedLevel, type DepositSettings, type UndepositedLevel } from './deposit-rules'
import { getDepositSettings } from './deposit-service'

// F2-2 Setoran — semua bacaan untuk layar POS › Setor Tunai, BO › Setoran, dan Detail Shift.

type Row = Record<string, unknown>
const num = (v: unknown) => (v == null ? 0 : Number(v))
const numOrNull = (v: unknown) => (v == null ? null : Number(v))
const strOrNull = (v: unknown) => (v == null ? null : String(v))

const CLOSED_ON = sql`to_char(COALESCE(s.closed_at, s.force_closed_at, s.opened_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`
const OPENED_ON = sql`to_char(s.opened_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`
const SHIFT_CASH = sql`(CASE WHEN s.origin = 'POS' AND s.status = 'CLOSED' AND s.total_closing_cash_real IS NOT NULL
  THEN s.total_closing_cash_real ELSE COALESCE(s.total_closing_cash_expected, 0) END)`

/** Shift yang termasuk alur Setoran tunai (spec §6 no.1 + §7): baru sejak tanggal mulai, atau POS lama belum diverifikasi. */
function cashFlowCondition(startDate: string) {
  return sql`s.status IN ('CLOSED', 'FORCE_CLOSED')
    AND (${CLOSED_ON} >= ${startDate} OR (s.origin = 'POS' AND s.deposit_verified_at IS NULL))`
}

// ── Tunai belum disetor ────────────────────────────────────────────────────

export interface UndepositedShift {
  shiftId: number
  shiftNumber: number
  branchId: number
  branchName: string
  origin: string
  status: string
  openedOn: string
  closedOn: string
  cash: number
  ageDays: number
  /** Shift sebelum tanggal mulai yang belum diverifikasi cara lama. */
  legacy: boolean
  cashiers: { id: number; name: string }[]
}

export async function listUndepositedShifts(params: { branchId: number | null; settings?: DepositSettings }): Promise<UndepositedShift[]> {
  const settings = params.settings ?? (await getDepositSettings())
  const today = todayWibDate()
  const branchFilter = params.branchId != null ? sql`AND s.branch_id = ${params.branchId}` : sql``
  const rows = (await db.execute(sql`
    SELECT s.id, s.shift_number, s.branch_id, b.name AS branch_name, s.origin, s.status,
      ${OPENED_ON} AS opened_on, ${CLOSED_ON} AS closed_on, ${SHIFT_CASH} AS cash,
      COALESCE((
        SELECT json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name)
        FROM petshop.users u
        WHERE u.id IN (
          SELECT scb.cashier_id FROM petshop.shift_cashier_breakdown scb WHERE scb.shift_id = s.id
          UNION SELECT jsonb_array_elements_text(s.assigned_cashiers)::int
        )
      ), '[]'::json) AS cashiers
    FROM petshop.shifts s
    JOIN petshop.branches b ON b.id = s.branch_id
    WHERE ${cashFlowCondition(settings.startDate)}
      AND NOT EXISTS (SELECT 1 FROM petshop.cash_deposit_shifts ds WHERE ds.shift_id = s.id AND ds.released_at IS NULL)
      AND (${SHIFT_CASH} <> 0 OR COALESCE(s.total_closing_cash_expected, 0) <> 0)
      ${branchFilter}
    ORDER BY s.opened_at, s.id
  `)) as Row[]
  return rows.map((r) => ({
    shiftId: num(r.id),
    shiftNumber: num(r.shift_number),
    branchId: num(r.branch_id),
    branchName: String(r.branch_name),
    origin: String(r.origin),
    status: String(r.status),
    openedOn: String(r.opened_on),
    closedOn: String(r.closed_on),
    cash: num(r.cash),
    ageDays: ageInDays(String(r.closed_on), today),
    legacy: String(r.closed_on) < settings.startDate,
    cashiers: (r.cashiers as { id: number; name: string }[]) ?? [],
  }))
}

export interface UndepositedBranchSummary {
  branchId: number
  branchName: string
  shiftCount: number
  total: number
  oldestClosedOn: string
  oldestAgeDays: number
  legacyCount: number
  level: UndepositedLevel
}

export function summarizeUndeposited(rows: UndepositedShift[], settings: DepositSettings): UndepositedBranchSummary[] {
  const by = new Map<number, UndepositedBranchSummary>()
  for (const r of rows) {
    let s = by.get(r.branchId)
    if (!s) {
      s = { branchId: r.branchId, branchName: r.branchName, shiftCount: 0, total: 0, oldestClosedOn: r.closedOn, oldestAgeDays: 0, legacyCount: 0, level: 'OK' }
      by.set(r.branchId, s)
    }
    s.shiftCount += 1
    s.total += r.cash
    if (r.closedOn < s.oldestClosedOn) s.oldestClosedOn = r.closedOn
    s.oldestAgeDays = Math.max(s.oldestAgeDays, r.ageDays)
    if (r.legacy) s.legacyCount += 1
  }
  return [...by.values()]
    .map((s) => ({ ...s, level: undepositedLevel(s.oldestAgeDays, s.total, settings) }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName))
}

// ── Daftar setoran ─────────────────────────────────────────────────────────

export interface DepositListItem {
  id: number
  depositNumber: string
  branchId: number
  branchName: string
  status: string
  reportChannel: string
  depositDate: string
  destinationId: number
  destinationName: string
  destinationKind: string
  reportedAmount: number
  receivedAmount: number | null
  shiftTotal: number
  slipPhotoUrl: string | null
  notes: string | null
  reportedByName: string | null
  reportedAt: string
  verifiedByName: string | null
  verifiedAt: string | null
  verifiedHeldBy: string | null
  cancelledByName: string | null
  cancelReason: string | null
  correctsDepositNumber: string | null
  correctedByNumber: string | null
  shifts: { shiftId: number; shiftNumber: number; openedOn: string; cash: number; legacy: boolean; cashiers: { id: number; name: string }[] }[]
  variances: { amount: number; cause: string; shiftId: number | null; cashierName: string | null; note: string | null }[]
}

export async function listDeposits(params: {
  statuses: string[]
  branchId: number | null
  from?: string | null
  to?: string | null
  depositId?: number | null
  limit?: number
}): Promise<DepositListItem[]> {
  const settings = await getDepositSettings()
  const statusList = sql.join(params.statuses.map((s) => sql`${s}`), sql`, `)
  const filters = [
    sql`d.status IN (${statusList})`,
    params.branchId != null ? sql`d.branch_id = ${params.branchId}` : null,
    params.from ? sql`d.deposit_date >= ${params.from}::date` : null,
    params.to ? sql`d.deposit_date <= ${params.to}::date` : null,
    params.depositId ? sql`d.id = ${params.depositId}` : null,
  ].filter(Boolean) as ReturnType<typeof sql>[]
  const rows = (await db.execute(sql`
    SELECT d.*, to_char(d.deposit_date, 'YYYY-MM-DD') AS deposit_date_s,
      b.name AS branch_name, mp.name AS destination_name, mp.kind AS destination_kind,
      ru.name AS reported_by_name, vu.name AS verified_by_name, cu.name AS cancelled_by_name,
      od.deposit_number AS corrects_number,
      (SELECT nd.deposit_number FROM petshop.cash_deposits nd WHERE nd.corrects_deposit_id = d.id) AS corrected_by_number,
      COALESCE((
        SELECT json_agg(json_build_object(
          'shiftId', ds.shift_id, 'shiftNumber', s.shift_number, 'openedOn', ${OPENED_ON}, 'cash', ds.cash_amount,
          'legacy', ${CLOSED_ON} < ${settings.startDate},
          'cashiers', COALESCE((
            SELECT json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name)
            FROM petshop.users u
            WHERE u.id IN (
              SELECT scb.cashier_id FROM petshop.shift_cashier_breakdown scb WHERE scb.shift_id = s.id
              UNION SELECT jsonb_array_elements_text(s.assigned_cashiers)::int
            )
          ), '[]'::json)
        ) ORDER BY s.opened_at)
        FROM petshop.cash_deposit_shifts ds JOIN petshop.shifts s ON s.id = ds.shift_id
        -- Setoran batal/dikoreksi menampilkan shift yang dulu ada di dalamnya.
        WHERE ds.deposit_id = d.id AND (ds.released_at IS NULL OR d.status IN ('CANCELLED', 'CORRECTED'))
      ), '[]'::json) AS shifts,
      COALESCE((
        SELECT json_agg(json_build_object('amount', v.amount, 'cause', v.cause, 'shiftId', v.shift_id, 'cashierName', u.name, 'note', v.note) ORDER BY v.id)
        FROM petshop.cash_deposit_variances v LEFT JOIN petshop.users u ON u.id = v.cashier_id
        WHERE v.deposit_id = d.id
      ), '[]'::json) AS variances
    FROM petshop.cash_deposits d
    JOIN petshop.branches b ON b.id = d.branch_id
    JOIN petshop.money_places mp ON mp.id = d.destination_money_place_id
    LEFT JOIN petshop.users ru ON ru.id = d.reported_by
    LEFT JOIN petshop.users vu ON vu.id = d.verified_by
    LEFT JOIN petshop.users cu ON cu.id = d.cancelled_by
    LEFT JOIN petshop.cash_deposits od ON od.id = d.corrects_deposit_id
    WHERE ${sql.join(filters, sql` AND `)}
    ORDER BY COALESCE(d.verified_at, d.cancelled_at, d.reported_at) DESC, d.id DESC
    LIMIT ${params.limit ?? 200}
  `)) as Row[]
  return rows.map((r) => {
    const shifts = (r.shifts as DepositListItem['shifts']) ?? []
    return {
      id: num(r.id),
      depositNumber: String(r.deposit_number),
      branchId: num(r.branch_id),
      branchName: String(r.branch_name),
      status: String(r.status),
      reportChannel: String(r.report_channel),
      depositDate: String(r.deposit_date_s),
      destinationId: num(r.destination_money_place_id),
      destinationName: String(r.destination_name),
      destinationKind: String(r.destination_kind),
      reportedAmount: num(r.reported_amount),
      receivedAmount: numOrNull(r.received_amount),
      shiftTotal: shifts.reduce((sum, s) => sum + Number(s.cash), 0),
      slipPhotoUrl: strOrNull(r.slip_photo_url),
      notes: strOrNull(r.notes),
      reportedByName: strOrNull(r.reported_by_name),
      reportedAt: new Date(String(r.reported_at)).toISOString(),
      verifiedByName: strOrNull(r.verified_by_name),
      verifiedAt: r.verified_at ? new Date(String(r.verified_at)).toISOString() : null,
      verifiedHeldBy: strOrNull(r.verified_held_by),
      cancelledByName: strOrNull(r.cancelled_by_name),
      cancelReason: strOrNull(r.cancel_reason),
      correctsDepositNumber: strOrNull(r.corrects_number),
      correctedByNumber: strOrNull(r.corrected_by_number),
      shifts,
      variances: (r.variances as DepositListItem['variances']) ?? [],
    }
  })
}

// ── Non-tunai ──────────────────────────────────────────────────────────────

export type NoncashRowStatus = 'PENDING' | 'AWAITING_FUNDS' | 'VERIFIED'

export interface NoncashRow {
  /** Kunci baris di layar: `S<shift>:<metode>` atau `B<cabang>:<tanggal>:<metode>`. */
  key: string
  shiftId: number | null
  shiftNumber: number | null
  branchId: number
  branchName: string
  businessDate: string
  paymentMethodId: number
  paymentMethodName: string
  /** Angka sistem saat ini. */
  expected: number
  status: NoncashRowStatus
  verificationId: number | null
  /** Angka sistem yang disalin saat diverifikasi. */
  verifiedExpected: number | null
  received: number | null
  variance: number | null
  cause: string | null
  cashierName: string | null
  note: string | null
  verifiedByName: string | null
  verifiedAt: string | null
  moneyPlaceName: string | null
  /** Rekening tautan metode × cabang saat ini (null = belum ditautkan). */
  linkedPlaceName: string | null
  ageDays: number
  /** Angka sistem berubah sesudah diverifikasi (mis. nota dibatalkan). */
  changedAfterVerify: boolean
  /** Dana belum cair melewati batas hari. */
  overdue: boolean
  cashiers: { id: number; name: string }[]
}

export async function listNoncashRows(params: {
  branchId: number | null
  from?: string | null
  to?: string | null
  shiftId?: number | null
  paymentMethodId?: number | null
}): Promise<NoncashRow[]> {
  const settings = await getDepositSettings()
  const today = todayWibDate()
  const from = params.from ?? settings.startDate
  const to = params.to ?? today
  const shiftOnly = params.shiftId != null
  const shiftFilter = shiftOnly
    ? sql`s.id = ${params.shiftId}`
    : sql`${OPENED_ON} BETWEEN ${from} AND ${to} ${params.branchId != null ? sql`AND s.branch_id = ${params.branchId}` : sql``}`
  const boDate = sql`to_char(dp.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`
  const verFilter = shiftOnly
    ? sql`v.shift_id = ${params.shiftId}`
    : sql`v.business_date BETWEEN ${from}::date AND ${to}::date ${params.branchId != null ? sql`AND v.branch_id = ${params.branchId}` : sql``}`

  const rows = (await db.execute(sql`
    WITH sh AS (
      SELECT s.id, s.branch_id, s.shift_number, ${OPENED_ON} AS business_date
      FROM petshop.shifts s
      WHERE s.status IN ('CLOSED', 'FORCE_CLOSED') AND ${CLOSED_ON} >= ${settings.startDate} AND ${shiftFilter}
    ),
    computed AS (
      SELECT 'S' || x.shift_id || ':' || x.payment_method_id AS k, x.shift_id, sh.branch_id, sh.business_date,
        x.payment_method_id, SUM(x.amount)::bigint AS expected
      FROM (
        SELECT t.shift_id, tp.payment_method_id, tp.amount
        FROM petshop.transaction_payments tp JOIN petshop.transactions t ON t.id = tp.transaction_id
        WHERE t.status = 'COMPLETED' AND t.shift_id IN (SELECT id FROM sh)
        UNION ALL
        SELECT dp.shift_id, dp.payment_method_id, dp.amount
        FROM petshop.debt_payments dp
        WHERE dp.voided_at IS NULL AND dp.shift_id IN (SELECT id FROM sh)
      ) x JOIN sh ON sh.id = x.shift_id
      GROUP BY x.shift_id, sh.branch_id, sh.business_date, x.payment_method_id
      ${shiftOnly ? sql`` : sql`
      UNION ALL
      SELECT 'B' || COALESCE(dp.branch_id, cd.branch_id) || ':' || ${boDate} || ':' || dp.payment_method_id,
        NULL::int, COALESCE(dp.branch_id, cd.branch_id), ${boDate}, dp.payment_method_id, SUM(dp.amount)::bigint
      FROM petshop.debt_payments dp JOIN petshop.customer_debts cd ON cd.id = dp.debt_id
      WHERE dp.shift_id IS NULL AND dp.voided_at IS NULL
        AND COALESCE(dp.branch_id, cd.branch_id) IS NOT NULL
        AND ${boDate} >= ${settings.startDate} AND ${boDate} BETWEEN ${from} AND ${to}
        ${params.branchId != null ? sql`AND COALESCE(dp.branch_id, cd.branch_id) = ${params.branchId}` : sql``}
      GROUP BY COALESCE(dp.branch_id, cd.branch_id), ${boDate}, dp.payment_method_id`}
    ),
    ver AS (
      SELECT v.*, to_char(v.business_date, 'YYYY-MM-DD') AS business_date_s,
        CASE WHEN v.shift_id IS NOT NULL THEN 'S' || v.shift_id || ':' || v.payment_method_id
          ELSE 'B' || v.branch_id || ':' || to_char(v.business_date, 'YYYY-MM-DD') || ':' || v.payment_method_id END AS k
      FROM petshop.noncash_verifications v
      WHERE v.superseded_at IS NULL AND ${verFilter}
    )
    SELECT COALESCE(c.k, v.k) AS k, COALESCE(c.shift_id, v.shift_id) AS shift_id,
      COALESCE(c.branch_id, v.branch_id) AS branch_id, COALESCE(c.business_date, v.business_date_s) AS business_date,
      COALESCE(c.payment_method_id, v.payment_method_id) AS payment_method_id, COALESCE(c.expected, 0) AS expected,
      v.id AS verification_id, v.status AS v_status, v.expected_amount AS v_expected, v.received_amount, v.variance, v.cause,
      v.note, v.verified_at, vu.name AS verified_by_name, cu.name AS cashier_name, vmp.name AS money_place_name,
      pm.name AS payment_method_name, b.name AS branch_name, s.shift_number, lmp.name AS linked_place_name,
      COALESCE((
        SELECT json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name)
        FROM petshop.users u
        WHERE s.id IS NOT NULL AND u.id IN (
          SELECT scb.cashier_id FROM petshop.shift_cashier_breakdown scb WHERE scb.shift_id = s.id
          UNION SELECT jsonb_array_elements_text(s.assigned_cashiers)::int
        )
      ), '[]'::json) AS cashiers
    FROM computed c
    FULL OUTER JOIN ver v ON v.k = c.k
    JOIN petshop.payment_methods pm ON pm.id = COALESCE(c.payment_method_id, v.payment_method_id)
    JOIN petshop.branches b ON b.id = COALESCE(c.branch_id, v.branch_id)
    LEFT JOIN petshop.shifts s ON s.id = COALESCE(c.shift_id, v.shift_id)
    LEFT JOIN petshop.users vu ON vu.id = v.verified_by
    LEFT JOIN petshop.users cu ON cu.id = v.cashier_id
    LEFT JOIN petshop.money_places vmp ON vmp.id = v.money_place_id
    LEFT JOIN petshop.payment_method_money_places l
      ON l.payment_method_id = COALESCE(c.payment_method_id, v.payment_method_id) AND l.branch_id = COALESCE(c.branch_id, v.branch_id)
    LEFT JOIN petshop.money_places lmp ON lmp.id = l.money_place_id
    WHERE pm.type NOT IN ('CASH', 'DEBT') AND (COALESCE(c.expected, 0) <> 0 OR v.id IS NOT NULL)
      ${params.paymentMethodId ? sql`AND pm.id = ${params.paymentMethodId}` : sql``}
    ORDER BY COALESCE(c.business_date, v.business_date_s) DESC, b.name, s.shift_number NULLS LAST, pm.name
  `)) as Row[]

  return rows.map((r) => {
    const status: NoncashRowStatus = r.v_status === 'VERIFIED' ? 'VERIFIED' : r.v_status === 'AWAITING_FUNDS' ? 'AWAITING_FUNDS' : 'PENDING'
    const businessDate = String(r.business_date)
    const ageDays = ageInDays(businessDate, today)
    const expected = num(r.expected)
    return {
      key: String(r.k),
      shiftId: numOrNull(r.shift_id),
      shiftNumber: numOrNull(r.shift_number),
      branchId: num(r.branch_id),
      branchName: String(r.branch_name),
      businessDate,
      paymentMethodId: num(r.payment_method_id),
      paymentMethodName: String(r.payment_method_name),
      expected,
      status,
      verificationId: numOrNull(r.verification_id),
      verifiedExpected: numOrNull(r.v_expected),
      received: numOrNull(r.received_amount),
      variance: numOrNull(r.variance),
      cause: strOrNull(r.cause),
      cashierName: strOrNull(r.cashier_name),
      note: strOrNull(r.note),
      verifiedByName: strOrNull(r.verified_by_name),
      verifiedAt: r.verified_at ? new Date(String(r.verified_at)).toISOString() : null,
      moneyPlaceName: strOrNull(r.money_place_name),
      linkedPlaceName: strOrNull(r.linked_place_name),
      ageDays,
      changedAfterVerify: status === 'VERIFIED' && r.v_expected != null && num(r.v_expected) !== expected,
      overdue: status === 'AWAITING_FUNDS' && ageDays > settings.awaitingFundsDays,
      cashiers: (r.cashiers as { id: number; name: string }[]) ?? [],
    }
  })
}

// ── Status per shift (Detail Shift) ────────────────────────────────────────

export interface ShiftDepositStatus {
  /** NEW = alur Setoran · LEGACY = shift lama (verifikasi lama atau Setoran bertanda lama) · NONE = shift masih buka. */
  flow: 'NEW' | 'LEGACY' | 'NONE'
  cash: {
    state: 'NOT_DEPOSITED' | 'PENDING' | 'VERIFIED' | 'LEGACY_VERIFIED' | 'NOT_APPLICABLE'
    amount: number
    depositId: number | null
    depositNumber: string | null
    receivedAmount: number | null
  }
  noncash: NoncashRow[]
}

export async function getShiftDepositStatus(shiftId: number): Promise<ShiftDepositStatus> {
  const settings = await getDepositSettings()
  const [row] = (await db.execute(sql`
    SELECT s.status, s.origin, s.deposit_verified_at IS NOT NULL AS legacy_verified, ${CLOSED_ON} AS closed_on, ${SHIFT_CASH} AS cash,
      d.id AS deposit_id, d.deposit_number, d.status AS deposit_status, d.received_amount
    FROM petshop.shifts s
    LEFT JOIN petshop.cash_deposit_shifts ds ON ds.shift_id = s.id AND ds.released_at IS NULL
    LEFT JOIN petshop.cash_deposits d ON d.id = ds.deposit_id
    WHERE s.id = ${shiftId}
  `)) as Row[]
  const empty: ShiftDepositStatus = {
    flow: 'NONE',
    cash: { state: 'NOT_APPLICABLE', amount: 0, depositId: null, depositNumber: null, receivedAmount: null },
    noncash: [],
  }
  if (!row || row.status === 'OPEN') return empty
  const isNew = String(row.closed_on) >= settings.startDate
  const amount = num(row.cash)
  const deposit = {
    depositId: numOrNull(row.deposit_id),
    depositNumber: strOrNull(row.deposit_number),
    receivedAmount: numOrNull(row.received_amount),
  }
  let state: ShiftDepositStatus['cash']['state']
  if (row.deposit_id != null) state = row.deposit_status === 'VERIFIED' ? 'VERIFIED' : 'PENDING'
  else if (!isNew && row.legacy_verified === true) state = 'LEGACY_VERIFIED'
  else if (!isNew && row.origin !== 'POS') state = 'NOT_APPLICABLE'
  else state = 'NOT_DEPOSITED'
  return {
    flow: isNew ? 'NEW' : 'LEGACY',
    cash: { state, amount, ...deposit },
    noncash: isNew ? await listNoncashRows({ branchId: null, shiftId }) : [],
  }
}

/** Badge menu Setoran: setoran tunai menunggu verifikasi. */
export async function countPendingDeposits(branchId: number | null): Promise<number> {
  const [row] = (await db.execute(sql`
    SELECT count(*)::int AS n FROM petshop.cash_deposits
    WHERE status = 'PENDING' ${branchId != null ? sql`AND branch_id = ${branchId}` : sql``}
  `)) as Row[]
  return num(row?.n)
}

// ── Tujuan setoran ─────────────────────────────────────────────────────────

export interface DepositDestination {
  id: number
  name: string
  kind: 'BANK' | 'CASH'
  branchId: number
  branchName: string
  bankName: string | null
  accountNumber: string | null
  heldBy: string
}

export async function listDepositDestinations(): Promise<DepositDestination[]> {
  const rows = (await db.execute(sql`
    SELECT mp.id, mp.name, mp.kind, mp.branch_id, b.name AS branch_name, mp.bank_name, mp.account_number, mp.held_by
    FROM petshop.money_places mp JOIN petshop.branches b ON b.id = mp.branch_id
    WHERE mp.is_active AND mp.kind IN ('BANK', 'CASH')
    ORDER BY mp.kind DESC, b.name, mp.sort_order, mp.name
  `)) as Row[]
  return rows.map((r) => ({
    id: num(r.id),
    name: String(r.name),
    kind: r.kind === 'BANK' ? 'BANK' : 'CASH',
    branchId: num(r.branch_id),
    branchName: String(r.branch_name),
    bankName: strOrNull(r.bank_name),
    accountNumber: strOrNull(r.account_number),
    heldBy: String(r.held_by),
  }))
}

export async function listCashDepositDefaults(): Promise<{ branchId: number; moneyPlaceId: number }[]> {
  const rows = (await db.execute(sql`SELECT branch_id, money_place_id FROM petshop.cash_deposit_defaults`)) as Row[]
  return rows.map((r) => ({ branchId: num(r.branch_id), moneyPlaceId: num(r.money_place_id) }))
}
