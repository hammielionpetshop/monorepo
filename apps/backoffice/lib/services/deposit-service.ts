import {
  db, appSettings, auditLogs, branches, cashDeposits, cashDepositShifts, cashDepositVariances,
  cashDepositDefaults, moneyMovements, moneyPlaces, noncashVerifications, paymentMethods,
  paymentMethodMoneyPlaces, eq, and, isNull, sql,
} from '../db'
import { todayWibDate } from '../payment-date'
import {
  DEPOSIT_CORRECTOR_ROLES, DEPOSIT_SETTINGS_KEY, LEGACY_DEPOSIT_FROM, depositNumberPrefix, formatDepositNumber, isIsoDate,
  parseDepositSettings, shiftDepositCash, validateCashVarianceLines, validateDepositSettings, validateNoncashCause,
  type CashVarianceLine, type DepositSettings, type NoncashCause,
} from './deposit-rules'

// F2-2 Setoran — semua penulisan. Spec: docs/work/specs/2026-11-08-f2-2-setoran-design.md.
// Tidak ada hapus/timpa: batal/koreksi menambah baris & pembalikan; perpindahan uang dicatat
// otomatis di transaksi yang sama dengan tombol Verifikasi.

import { DepositError } from './deposit-error'
import { reverseSettlements, settleFromVerifiedSource } from './deposit-settlement-service'
export { DepositError }

export interface DepositActor {
  userId: number
  /** Cabang login — dipakai untuk audit log. */
  branchId: number
  role: string
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = Pick<typeof db, 'select' | 'execute'>

const ADVISORY_NAMESPACE = 815_056

// ── Pengaturan ──────────────────────────────────────────────────────────────

export async function getDepositSettings(executor: Executor = db): Promise<DepositSettings> {
  const [row] = await executor
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, DEPOSIT_SETTINGS_KEY))
    .limit(1)
  return parseDepositSettings(row?.value, todayWibDate())
}

export async function setDepositSettings(next: DepositSettings, actor: DepositActor): Promise<DepositSettings> {
  if (!DEPOSIT_CORRECTOR_ROLES.includes(actor.role)) throw new DepositError('Hanya Owner/GM yang boleh mengubah pengaturan Setoran', 403)
  const problem = validateDepositSettings(next)
  if (problem) throw new DepositError(problem)
  const value = JSON.stringify(next)
  return db.transaction(async (tx) => {
    const old = await getDepositSettings(tx)
    await tx
      .insert(appSettings)
      .values({ key: DEPOSIT_SETTINGS_KEY, value, updatedBy: actor.userId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actor.userId, updatedAt: new Date() } })
    await audit(tx, actor, 'DEPOSIT_SETTINGS_UPDATE', 'app_settings', DEPOSIT_SETTINGS_KEY, old, next)
    return next
  })
}

/** Tujuan bawaan setoran tunai per cabang (baris Tunai di Tempat Uang). `moneyPlaceId` null = lepas. */
export async function setCashDepositDefault(
  input: { branchId: number; moneyPlaceId: number | null },
  actor: DepositActor,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ moneyPlaceId: cashDepositDefaults.moneyPlaceId })
      .from(cashDepositDefaults)
      .where(eq(cashDepositDefaults.branchId, input.branchId))
      .limit(1)
    if (input.moneyPlaceId == null) {
      if (!before) return
      await tx.delete(cashDepositDefaults).where(eq(cashDepositDefaults.branchId, input.branchId))
      await audit(tx, actor, 'CASH_DEPOSIT_DEFAULT_REMOVE', 'cash_deposit_defaults', String(input.branchId), before, null)
      return
    }
    await getDestination(tx, input.moneyPlaceId, ['BANK', 'CASH'])
    if (before?.moneyPlaceId === input.moneyPlaceId) return
    await tx
      .insert(cashDepositDefaults)
      .values({ branchId: input.branchId, moneyPlaceId: input.moneyPlaceId, updatedBy: actor.userId })
      .onConflictDoUpdate({
        target: cashDepositDefaults.branchId,
        set: { moneyPlaceId: input.moneyPlaceId, updatedBy: actor.userId, updatedAt: new Date() },
      })
    await audit(tx, actor, 'CASH_DEPOSIT_DEFAULT_SET', 'cash_deposit_defaults', String(input.branchId), before ?? null, { moneyPlaceId: input.moneyPlaceId })
  })
}

// ── Bantu ──────────────────────────────────────────────────────────────────

function audit(tx: Tx, actor: DepositActor, action: string, tableName: string, recordId: string, oldData: unknown, newData: unknown) {
  return tx.insert(auditLogs).values({
    branchId: actor.branchId,
    userId: actor.userId,
    action,
    tableName,
    recordId,
    oldData: oldData == null ? null : JSON.stringify(oldData),
    newData: newData == null ? null : JSON.stringify(newData),
  })
}

async function getDestination(tx: Tx, id: number, kinds: ('BANK' | 'CASH')[]) {
  const [place] = await tx.select().from(moneyPlaces).where(eq(moneyPlaces.id, id)).limit(1)
  if (!place) throw new DepositError('Tempat Uang tujuan tidak ditemukan', 404)
  if (place.kind === 'DRAWER') throw new DepositError('Tujuan setoran tidak boleh Laci kasir')
  if (!(kinds as string[]).includes(place.kind)) {
    throw new DepositError(kinds.length === 1 && kinds[0] === 'BANK' ? 'Setor tunai dari POS hanya ke Rekening' : 'Tujuan setoran harus Rekening atau Tunai')
  }
  if (!place.isActive) throw new DepositError(`Tempat Uang "${place.name}" sedang nonaktif`)
  return place
}

async function getDrawer(tx: Tx, branchId: number) {
  const [drawer] = await tx
    .select({ id: moneyPlaces.id })
    .from(moneyPlaces)
    .where(and(eq(moneyPlaces.branchId, branchId), eq(moneyPlaces.kind, 'DRAWER')))
    .limit(1)
  if (!drawer) throw new DepositError('Laci kasir cabang ini belum ada di Tempat Uang', 409)
  return drawer.id
}

interface EligibleShift {
  id: number
  branchId: number
  cash: number
  cashierIds: number[]
}

/**
 * Kunci & periksa shift yang akan dimasukkan setoran: satu cabang, sudah tutup, belum di setoran
 * aktif, dan termasuk alur Setoran (ditutup sejak tanggal mulai, atau shift POS lama yang belum
 * diverifikasi cara lama).
 */
async function lockEligibleShifts(tx: Tx, branchId: number, shiftIds: number[], settings: DepositSettings): Promise<EligibleShift[]> {
  const unique = [...new Set(shiftIds)]
  if (unique.length === 0) throw new DepositError('Pilih minimal satu shift')
  if (unique.length !== shiftIds.length) throw new DepositError('Shift yang sama terpilih dua kali')
  const idList = sql.join(unique.map((id) => sql`${id}`), sql`, `)
  const rows = (await tx.execute(sql`
    SELECT s.id, s.branch_id, s.origin, s.status, s.total_closing_cash_real, s.total_closing_cash_expected,
      s.deposit_verified_at IS NOT NULL AS legacy_verified, s.assigned_cashiers,
      to_char(COALESCE(s.closed_at, s.force_closed_at, s.opened_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS closed_on,
      EXISTS (SELECT 1 FROM petshop.cash_deposit_shifts ds WHERE ds.shift_id = s.id AND ds.released_at IS NULL) AS in_deposit,
      ARRAY(SELECT b.cashier_id FROM petshop.shift_cashier_breakdown b WHERE b.shift_id = s.id) AS breakdown_cashiers
    FROM petshop.shifts s
    WHERE s.id IN (${idList})
    ORDER BY s.opened_at, s.id
    FOR UPDATE OF s
  `)) as Record<string, unknown>[]
  if (rows.length !== unique.length) throw new DepositError('Ada shift yang tidak ditemukan', 404)

  return rows.map((r) => {
    if (Number(r.branch_id) !== branchId) throw new DepositError('Semua shift dalam satu setoran harus dari cabang yang sama')
    if (r.status === 'OPEN') throw new DepositError('Shift masih berjalan — tutup shift dulu sebelum disetor')
    if (r.in_deposit === true) throw new DepositError('Ada shift yang sudah masuk setoran lain', 409, 'SHIFT_TAKEN')
    const isNew = String(r.closed_on) >= settings.startDate
    if (!isNew && (r.origin !== 'POS' || r.legacy_verified === true || String(r.closed_on) < LEGACY_DEPOSIT_FROM)) {
      throw new DepositError('Ada shift lama yang sudah diverifikasi dengan cara lama atau tidak termasuk Setoran', 409)
    }
    const cash = shiftDepositCash({
      origin: String(r.origin),
      status: String(r.status),
      totalClosingCashReal: r.total_closing_cash_real != null ? Number(r.total_closing_cash_real) : null,
      totalClosingCashExpected: r.total_closing_cash_expected != null ? Number(r.total_closing_cash_expected) : null,
    })
    const breakdown = (r.breakdown_cashiers as unknown[] | null ?? []).map(Number)
    const assigned = Array.isArray(r.assigned_cashiers) ? (r.assigned_cashiers as unknown[]).map(Number) : []
    return { id: Number(r.id), branchId, cash, cashierIds: [...new Set([...breakdown, ...assigned])] }
  })
}

async function nextDepositNumber(tx: Tx, branchId: number, date: string): Promise<string> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADVISORY_NAMESPACE}, ${branchId})`)
  const [branch] = await tx.select({ code: branches.code }).from(branches).where(eq(branches.id, branchId)).limit(1)
  if (!branch) throw new DepositError('Cabang tidak ditemukan', 404)
  const prefix = depositNumberPrefix(branch.code, date)
  const [row] = (await tx.execute(sql`
    SELECT COALESCE(MAX(substring(deposit_number FROM ${prefix.length + 1}::int)::int), 0) AS last
    FROM petshop.cash_deposits WHERE deposit_number LIKE ${prefix + '%'}
  `)) as Record<string, unknown>[]
  return formatDepositNumber(prefix, Number(row?.last ?? 0) + 1)
}

function cleanText(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } }
  return e?.code === '23505' || e?.cause?.code === '23505'
}

async function withShiftConflict<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (isUniqueViolation(error)) throw new DepositError('Ada shift yang baru saja masuk setoran lain — muat ulang daftar', 409, 'SHIFT_TAKEN')
    throw error
  }
}

// ── Setoran Tunai ──────────────────────────────────────────────────────────

export interface ReportDepositInput {
  branchId: number
  shiftIds: number[]
  destinationMoneyPlaceId: number
  reportedAmount: number
  depositDate: string
  slipPhotoUrl?: string | null
  notes?: string | null
}

function assertAmountAndDate(amount: number, date: string, label: string) {
  if (!Number.isInteger(amount) || amount < 0) throw new DepositError(`${label} harus rupiah bulat ≥ 0`)
  if (!isIsoDate(date)) throw new DepositError('Tanggal setor tidak valid')
  if (date > todayWibDate()) throw new DepositError('Tanggal setor tidak boleh di masa depan')
}

async function insertDeposit(
  tx: Tx,
  input: ReportDepositInput,
  shifts: EligibleShift[],
  channel: 'POS' | 'BACKOFFICE',
  actor: DepositActor,
  extra: { correctsDepositId?: number | null } = {},
) {
  const depositNumber = await nextDepositNumber(tx, input.branchId, input.depositDate)
  const [created] = await tx
    .insert(cashDeposits)
    .values({
      depositNumber,
      branchId: input.branchId,
      destinationMoneyPlaceId: input.destinationMoneyPlaceId,
      depositDate: input.depositDate,
      reportedAmount: input.reportedAmount,
      slipPhotoUrl: cleanText(input.slipPhotoUrl),
      reportChannel: channel,
      reportedBy: actor.userId,
      notes: cleanText(input.notes),
      correctsDepositId: extra.correctsDepositId ?? null,
    })
    .returning()
  await tx.insert(cashDepositShifts).values(shifts.map((s) => ({ depositId: created.id, shiftId: s.id, cashAmount: s.cash })))
  return created
}

/** POS › Setor Tunai: tim cabang melapor setor bank → Menunggu Verifikasi Finance. */
export async function reportCashDeposit(input: ReportDepositInput, actor: DepositActor) {
  assertAmountAndDate(input.reportedAmount, input.depositDate, 'Nominal setor')
  const settings = await getDepositSettings()
  return withShiftConflict(() =>
    db.transaction(async (tx) => {
      await getDestination(tx, input.destinationMoneyPlaceId, ['BANK'])
      const shifts = await lockEligibleShifts(tx, input.branchId, input.shiftIds, settings)
      const created = await insertDeposit(tx, input, shifts, 'POS', actor)
      await audit(tx, actor, 'CASH_DEPOSIT_REPORT', 'cash_deposits', String(created.id), null, {
        depositNumber: created.depositNumber, shiftIds: shifts.map((s) => s.id), reportedAmount: input.reportedAmount,
        destinationMoneyPlaceId: input.destinationMoneyPlaceId,
      })
      return created
    }),
  )
}

export interface VerifyCashInput {
  receivedAmount: number
  variances: CashVarianceLine[]
  /** Ganti tujuan saat verifikasi (opsional). */
  destinationMoneyPlaceId?: number | null
  notes?: string | null
}

async function applyVerification(
  tx: Tx,
  deposit: typeof cashDeposits.$inferSelect,
  shifts: { shiftId: number; cash: number; cashierIds: number[] }[],
  input: VerifyCashInput,
  actor: DepositActor,
) {
  if (!Number.isInteger(input.receivedAmount) || input.receivedAmount < 0) throw new DepositError('Nominal diterima harus rupiah bulat ≥ 0')
  const destinationId = input.destinationMoneyPlaceId ?? deposit.destinationMoneyPlaceId
  const destination = await getDestination(tx, destinationId, ['BANK', 'CASH'])
  const shiftTotal = shifts.reduce((sum, s) => sum + s.cash, 0)
  const variance = input.receivedAmount - shiftTotal
  const lines = input.variances.map((l) => ({ ...l, note: cleanText(l.note) }))
  const problem = validateCashVarianceLines(variance, lines, new Map(shifts.map((s) => [s.shiftId, new Set(s.cashierIds)])))
  if (problem) throw new DepositError(problem)

  if (lines.length > 0) {
    await tx.insert(cashDepositVariances).values(lines.map((l) => ({
      depositId: deposit.id,
      amount: l.amount,
      cause: l.cause,
      shiftId: l.shiftId ?? null,
      cashierId: l.cause === 'CASHIER_SHORT' || l.cause === 'CASHIER_OVER' ? l.cashierId ?? null : null,
      note: l.note,
    })))
  }
  const now = new Date()
  const notes = input.notes !== undefined ? cleanText(input.notes) : deposit.notes
  const [updated] = await tx
    .update(cashDeposits)
    .set({
      status: 'VERIFIED',
      receivedAmount: input.receivedAmount,
      destinationMoneyPlaceId: destinationId,
      verifiedBy: actor.userId,
      verifiedAt: now,
      verifiedHeldBy: destination.heldBy,
      notes,
    })
    .where(and(eq(cashDeposits.id, deposit.id), eq(cashDeposits.status, 'PENDING')))
    .returning()
  if (!updated) throw new DepositError('Setoran sudah tidak menunggu verifikasi — muat ulang', 409)

  if (input.receivedAmount > 0) {
    await tx.insert(moneyMovements).values({
      fromMoneyPlaceId: await getDrawer(tx, deposit.branchId),
      toMoneyPlaceId: destinationId,
      amount: input.receivedAmount,
      occurredOn: deposit.depositDate,
      sourceType: 'CASH_DEPOSIT',
      sourceId: deposit.id,
      createdBy: actor.userId,
    })
  }
  const settlement = await settleFromVerifiedSource(tx, {
    sourceType: 'CASH_DEPOSIT', sourceId: deposit.id, branchId: deposit.branchId, amount: input.receivedAmount,
    heldBy: destination.heldBy, reference: deposit.depositNumber, userId: actor.userId, now,
  })
  return { updated, variance, shiftTotal, settlement }
}

async function lockDeposit(tx: Tx, id: number) {
  const [deposit] = await tx.select().from(cashDeposits).where(eq(cashDeposits.id, id)).for('update')
  if (!deposit) throw new DepositError('Setoran tidak ditemukan', 404)
  return deposit
}

async function depositShiftsWithCashiers(tx: Tx, depositId: number) {
  const rows = (await tx.execute(sql`
    SELECT ds.shift_id, ds.cash_amount, s.assigned_cashiers,
      ARRAY(SELECT b.cashier_id FROM petshop.shift_cashier_breakdown b WHERE b.shift_id = ds.shift_id) AS breakdown_cashiers
    FROM petshop.cash_deposit_shifts ds
    JOIN petshop.shifts s ON s.id = ds.shift_id
    WHERE ds.deposit_id = ${depositId} AND ds.released_at IS NULL
    ORDER BY ds.shift_id
  `)) as Record<string, unknown>[]
  return rows.map((r) => {
    const breakdown = (r.breakdown_cashiers as unknown[] | null ?? []).map(Number)
    const assigned = Array.isArray(r.assigned_cashiers) ? (r.assigned_cashiers as unknown[]).map(Number) : []
    return { shiftId: Number(r.shift_id), cash: Number(r.cash_amount), cashierIds: [...new Set([...breakdown, ...assigned])] }
  })
}

/** Finance memverifikasi setoran yang dilaporkan cabang. */
export async function verifyCashDeposit(id: number, input: VerifyCashInput, actor: DepositActor) {
  return db.transaction(async (tx) => {
    const deposit = await lockDeposit(tx, id)
    if (deposit.status !== 'PENDING') throw new DepositError('Setoran ini tidak sedang menunggu verifikasi', 409)
    const shifts = await depositShiftsWithCashiers(tx, id)
    const result = await applyVerification(tx, deposit, shifts, input, actor)
    await audit(tx, actor, 'CASH_DEPOSIT_VERIFY', 'cash_deposits', String(id), { status: deposit.status }, {
      receivedAmount: input.receivedAmount, variance: result.variance, variances: input.variances,
      destinationMoneyPlaceId: result.updated.destinationMoneyPlaceId, settlement: result.settlement,
    })
    return { ...result.updated, settlement: result.settlement }
  })
}

/** Terima Setoran (uang diantar ke kantor / Bulk Sale Gudang): dibuat Finance, langsung terverifikasi. */
export async function receiveCashDeposit(
  input: Omit<ReportDepositInput, 'reportedAmount'> & { receivedAmount: number; variances: CashVarianceLine[] },
  actor: DepositActor,
) {
  assertAmountAndDate(input.receivedAmount, input.depositDate, 'Nominal diterima')
  const settings = await getDepositSettings()
  return withShiftConflict(() =>
    db.transaction(async (tx) => {
      await getDestination(tx, input.destinationMoneyPlaceId, ['BANK', 'CASH'])
      const shifts = await lockEligibleShifts(tx, input.branchId, input.shiftIds, settings)
      const created = await insertDeposit(tx, { ...input, reportedAmount: input.receivedAmount }, shifts, 'BACKOFFICE', actor)
      const result = await applyVerification(
        tx, created, shifts.map((s) => ({ shiftId: s.id, cash: s.cash, cashierIds: s.cashierIds })),
        { receivedAmount: input.receivedAmount, variances: input.variances }, actor,
      )
      await audit(tx, actor, 'CASH_DEPOSIT_RECEIVE', 'cash_deposits', String(created.id), null, {
        depositNumber: created.depositNumber, shiftIds: shifts.map((s) => s.id), receivedAmount: input.receivedAmount,
        variance: result.variance, variances: input.variances, destinationMoneyPlaceId: input.destinationMoneyPlaceId,
        settlement: result.settlement,
      })
      return { ...result.updated, settlement: result.settlement }
    }),
  )
}

/** Batal hanya selama menunggu verifikasi; shift kembali ke "Tunai belum disetor". */
export async function cancelCashDeposit(
  id: number,
  reason: string,
  actor: DepositActor,
  scope: { branchId: number | null },
) {
  const cleanReason = cleanText(reason)
  if (!cleanReason) throw new DepositError('Alasan batal wajib diisi')
  return db.transaction(async (tx) => {
    const deposit = await lockDeposit(tx, id)
    if (scope.branchId != null && deposit.branchId !== scope.branchId) throw new DepositError('Setoran ini bukan milik cabang Anda', 403)
    if (deposit.status !== 'PENDING') throw new DepositError('Hanya setoran yang menunggu verifikasi yang bisa dibatalkan', 409)
    const now = new Date()
    const [updated] = await tx
      .update(cashDeposits)
      .set({ status: 'CANCELLED', cancelledBy: actor.userId, cancelledAt: now, cancelReason: cleanReason.slice(0, 255) })
      .where(eq(cashDeposits.id, id))
      .returning()
    await tx.update(cashDepositShifts).set({ releasedAt: now })
      .where(and(eq(cashDepositShifts.depositId, id), isNull(cashDepositShifts.releasedAt)))
    await audit(tx, actor, 'CASH_DEPOSIT_CANCEL', 'cash_deposits', String(id), { status: deposit.status }, { status: 'CANCELLED', reason: cleanReason })
    return updated
  })
}

async function reverseMovements(tx: Tx, sourceType: 'CASH_DEPOSIT' | 'NONCASH_VERIFICATION', sourceId: number, actor: DepositActor) {
  const rows = await tx
    .select()
    .from(moneyMovements)
    .where(and(eq(moneyMovements.sourceType, sourceType), eq(moneyMovements.sourceId, sourceId), isNull(moneyMovements.reversalOfId)))
  for (const m of rows) {
    const [already] = await tx.select({ id: moneyMovements.id }).from(moneyMovements).where(eq(moneyMovements.reversalOfId, m.id)).limit(1)
    if (already) continue
    await tx.insert(moneyMovements).values({
      fromMoneyPlaceId: m.fromMoneyPlaceId,
      toMoneyPlaceId: m.toMoneyPlaceId,
      amount: -m.amount,
      occurredOn: m.occurredOn,
      sourceType,
      sourceId,
      reversalOfId: m.id,
      createdBy: actor.userId,
    })
  }
}

/**
 * Koreksi setoran terverifikasi (Owner/GM): setoran lama → CORRECTED + pembalikan perpindahan uang,
 * setoran koreksi baru (shift yang sama) langsung terverifikasi dengan angka baru.
 */
export async function correctCashDeposit(
  id: number,
  input: VerifyCashInput & { depositDate?: string | null; reason: string },
  actor: DepositActor,
) {
  if (!DEPOSIT_CORRECTOR_ROLES.includes(actor.role)) throw new DepositError('Koreksi setoran terverifikasi hanya oleh Owner/GM', 403)
  const reason = cleanText(input.reason)
  if (!reason) throw new DepositError('Alasan koreksi wajib diisi')
  return db.transaction(async (tx) => {
    const old = await lockDeposit(tx, id)
    if (old.status !== 'VERIFIED') throw new DepositError('Hanya setoran terverifikasi yang bisa dikoreksi', 409)
    const shifts = await depositShiftsWithCashiers(tx, id)
    const depositDate = input.depositDate ?? old.depositDate
    assertAmountAndDate(input.receivedAmount, depositDate, 'Nominal diterima')

    const now = new Date()
    await tx.update(cashDeposits).set({ status: 'CORRECTED' }).where(eq(cashDeposits.id, id))
    await tx.update(cashDepositShifts).set({ releasedAt: now })
      .where(and(eq(cashDepositShifts.depositId, id), isNull(cashDepositShifts.releasedAt)))
    await reverseMovements(tx, 'CASH_DEPOSIT', id, actor)
    await reverseSettlements(tx, { sourceType: 'CASH_DEPOSIT', sourceId: id, reference: old.depositNumber, reason, userId: actor.userId, now })

    const created = await insertDeposit(
      tx,
      {
        branchId: old.branchId,
        shiftIds: shifts.map((s) => s.shiftId),
        destinationMoneyPlaceId: input.destinationMoneyPlaceId ?? old.destinationMoneyPlaceId,
        reportedAmount: old.reportedAmount,
        depositDate,
        slipPhotoUrl: old.slipPhotoUrl,
        notes: `Koreksi ${old.depositNumber}: ${reason}`,
      },
      shifts.map((s) => ({ id: s.shiftId, branchId: old.branchId, cash: s.cash, cashierIds: s.cashierIds })),
      old.reportChannel === 'POS' ? 'POS' : 'BACKOFFICE',
      actor,
      { correctsDepositId: id },
    )
    const result = await applyVerification(tx, created, shifts, { ...input, notes: undefined }, actor)
    await audit(tx, actor, 'CASH_DEPOSIT_CORRECT', 'cash_deposits', String(id),
      { status: 'VERIFIED', receivedAmount: old.receivedAmount, destinationMoneyPlaceId: old.destinationMoneyPlaceId },
      { status: 'CORRECTED', correctedBy: created.id, correctionNumber: created.depositNumber, receivedAmount: input.receivedAmount, variances: input.variances, reason, settlement: result.settlement })
    return { ...result.updated, settlement: result.settlement }
  })
}

// ── Non-tunai ──────────────────────────────────────────────────────────────

/** Nomor referensi pelunasan otomatis dari verifikasi non-tunai (tampil di riwayat Utang Internal). */
export function noncashReference(id: number): string {
  return `NT-${id}`
}

export interface NoncashKey {
  /** null = pelunasan non-tunai dari Back Office tanpa shift (per cabang per hari). */
  shiftId: number | null
  branchId: number
  /** 'YYYY-MM-DD' WIB — untuk baris tanpa shift. Untuk shift diambil dari shift itu. */
  businessDate: string | null
  paymentMethodId: number
}

/** Angka sistem satu baris non-tunai: nota COMPLETED + pelunasan (belum void) di shift / hari itu. */
export async function computeNoncashExpected(
  executor: Executor,
  key: NoncashKey,
): Promise<{ expected: number; branchId: number; businessDate: string; closedOn: string }> {
  if (key.shiftId != null) {
    const [row] = (await executor.execute(sql`
      SELECT s.branch_id, s.status,
        to_char(s.opened_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS business_date,
        to_char(COALESCE(s.closed_at, s.force_closed_at, s.opened_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS closed_on,
        COALESCE((SELECT SUM(tp.amount) FROM petshop.transaction_payments tp
          JOIN petshop.transactions t ON t.id = tp.transaction_id
          WHERE t.shift_id = s.id AND t.status = 'COMPLETED' AND tp.payment_method_id = ${key.paymentMethodId}), 0)
        + COALESCE((SELECT SUM(dp.amount) FROM petshop.debt_payments dp
          WHERE dp.shift_id = s.id AND dp.voided_at IS NULL AND dp.payment_method_id = ${key.paymentMethodId}), 0) AS expected
      FROM petshop.shifts s WHERE s.id = ${key.shiftId}
    `)) as Record<string, unknown>[]
    if (!row) throw new DepositError('Shift tidak ditemukan', 404)
    if (row.status === 'OPEN') throw new DepositError('Shift masih berjalan — non-tunai diverifikasi sesudah shift ditutup')
    return { expected: Number(row.expected), branchId: Number(row.branch_id), businessDate: String(row.business_date), closedOn: String(row.closed_on) }
  }
  if (!key.businessDate || !isIsoDate(key.businessDate)) throw new DepositError('Tanggal pelunasan tidak valid')
  const [row] = (await executor.execute(sql`
    SELECT COALESCE(SUM(dp.amount), 0) AS expected
    FROM petshop.debt_payments dp
    JOIN petshop.customer_debts cd ON cd.id = dp.debt_id
    WHERE dp.shift_id IS NULL AND dp.voided_at IS NULL AND dp.payment_method_id = ${key.paymentMethodId}
      AND COALESCE(dp.branch_id, cd.branch_id) = ${key.branchId}
      AND to_char(dp.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') = ${key.businessDate}
  `)) as Record<string, unknown>[]
  return { expected: Number(row?.expected ?? 0), branchId: key.branchId, businessDate: key.businessDate, closedOn: key.businessDate }
}

async function resolveNoncashPlace(tx: Tx, branchId: number, paymentMethodId: number) {
  const [method] = await tx.select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
    .from(paymentMethods).where(eq(paymentMethods.id, paymentMethodId)).limit(1)
  if (!method) throw new DepositError('Metode bayar tidak ditemukan', 404)
  if (method.type === 'CASH' || method.type === 'DEBT') throw new DepositError('Metode ini bukan non-tunai')
  const [link] = await tx
    .select({ id: moneyPlaces.id, heldBy: moneyPlaces.heldBy, isActive: moneyPlaces.isActive, name: moneyPlaces.name })
    .from(paymentMethodMoneyPlaces)
    .innerJoin(moneyPlaces, eq(moneyPlaces.id, paymentMethodMoneyPlaces.moneyPlaceId))
    .where(and(eq(paymentMethodMoneyPlaces.branchId, branchId), eq(paymentMethodMoneyPlaces.paymentMethodId, paymentMethodId)))
    .limit(1)
  if (!link) throw new DepositError(`${method.name} di cabang ini belum ditautkan ke rekening. Tautkan dulu di Pengaturan › Tempat Uang`, 409, 'NOT_LINKED')
  if (!link.isActive) throw new DepositError(`Rekening "${link.name}" sedang nonaktif — ganti tautannya di Pengaturan › Tempat Uang`, 409, 'NOT_LINKED')
  return link
}

export interface NoncashInput extends NoncashKey {
  /** true = simpan Dana belum cair (belum ada perpindahan uang). */
  awaitingFunds: boolean
  receivedAmount?: number | null
  cause?: NoncashCause | null
  cashierId?: number | null
  note?: string | null
}

async function lockActiveNoncash(tx: Tx, key: { shiftId: number | null; branchId: number; businessDate: string; paymentMethodId: number }) {
  const [row] = await tx
    .select()
    .from(noncashVerifications)
    .where(and(
      key.shiftId != null ? eq(noncashVerifications.shiftId, key.shiftId) : and(
        isNull(noncashVerifications.shiftId),
        eq(noncashVerifications.branchId, key.branchId),
        eq(noncashVerifications.businessDate, key.businessDate),
      ),
      eq(noncashVerifications.paymentMethodId, key.paymentMethodId),
      isNull(noncashVerifications.supersededAt),
    ))
    .for('update')
  return row ?? null
}

async function assertShiftCashier(tx: Tx, shiftId: number | null, cashierId: number | null | undefined) {
  if (!cashierId) return
  if (shiftId == null) throw new DepositError('Kasir hanya bisa dipilih untuk baris shift')
  const [row] = (await tx.execute(sql`
    SELECT 1 FROM petshop.shifts s
    WHERE s.id = ${shiftId} AND (
      EXISTS (SELECT 1 FROM petshop.shift_cashier_breakdown b WHERE b.shift_id = s.id AND b.cashier_id = ${cashierId})
      OR s.assigned_cashiers @> ${JSON.stringify([cashierId])}::jsonb
    )
  `)) as Record<string, unknown>[]
  if (!row) throw new DepositError('Kasir yang dipilih tidak bertugas di shift itu')
}

/** Simpan Dana belum cair atau Verifikasi satu baris non-tunai (per shift per metode). */
export async function saveNoncashVerification(input: NoncashInput, actor: DepositActor) {
  const settings = await getDepositSettings()
  try {
    return await db.transaction(async (tx) => {
      if (input.shiftId != null) {
        await tx.execute(sql`SELECT 1 FROM petshop.shifts WHERE id = ${input.shiftId} FOR UPDATE`)
      } else {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADVISORY_NAMESPACE + 1}, ${input.branchId})`)
      }
      const computed = await computeNoncashExpected(tx, input)
      // Shift/pelunasan sebelum tanggal mulai tidak diantrekan non-tunai (spec §7).
      if (computed.closedOn < settings.startDate) {
        throw new DepositError('Shift/pelunasan sebelum tanggal mulai Setoran tidak diverifikasi non-tunai')
      }
      const key = { ...input, branchId: computed.branchId, businessDate: computed.businessDate }
      const place = await resolveNoncashPlace(tx, key.branchId, key.paymentMethodId)
      const existing = await lockActiveNoncash(tx, key)
      if (existing?.status === 'VERIFIED') throw new DepositError('Baris ini sudah diverifikasi. Koreksi hanya oleh Owner/GM', 409)

      const now = new Date()
      if (input.awaitingFunds) {
        const note = cleanText(input.note)
        const values = {
          expectedAmount: computed.expected, moneyPlaceId: place.id, heldBy: place.heldBy, status: 'AWAITING_FUNDS',
          receivedAmount: null, variance: null, cause: 'AWAITING_FUNDS', cashierId: null, note,
        }
        if (existing) {
          const [updated] = await tx.update(noncashVerifications).set(values).where(eq(noncashVerifications.id, existing.id)).returning()
          await audit(tx, actor, 'NONCASH_AWAITING_FUNDS', 'noncash_verifications', String(existing.id), { note: existing.note }, { expected: computed.expected, note })
          return updated
        }
        const [created] = await tx.insert(noncashVerifications).values({
          ...values, shiftId: key.shiftId, branchId: key.branchId, businessDate: key.businessDate,
          paymentMethodId: key.paymentMethodId, createdBy: actor.userId,
        }).returning()
        await audit(tx, actor, 'NONCASH_AWAITING_FUNDS', 'noncash_verifications', String(created.id), null, { expected: computed.expected, note })
        return created
      }

      const received = input.receivedAmount
      if (received == null || !Number.isInteger(received) || received < 0) throw new DepositError('Nominal diterima wajib diketik dari mutasi (rupiah bulat ≥ 0)')
      const variance = received - computed.expected
      const cause = variance === 0 ? null : input.cause ?? null
      const problem = validateNoncashCause(variance, cause, input.note)
      if (problem) throw new DepositError(problem)
      if (cause === 'CASHIER_INPUT') await assertShiftCashier(tx, key.shiftId, input.cashierId)
      const values = {
        expectedAmount: computed.expected, moneyPlaceId: place.id, heldBy: place.heldBy, status: 'VERIFIED',
        receivedAmount: received, variance, cause, cashierId: cause === 'CASHIER_INPUT' ? input.cashierId ?? null : null,
        note: cleanText(input.note), verifiedBy: actor.userId, verifiedAt: now,
      }
      let row: typeof noncashVerifications.$inferSelect
      if (existing) {
        ;[row] = await tx.update(noncashVerifications).set(values).where(eq(noncashVerifications.id, existing.id)).returning()
      } else {
        ;[row] = await tx.insert(noncashVerifications).values({
          ...values, shiftId: key.shiftId, branchId: key.branchId, businessDate: key.businessDate,
          paymentMethodId: key.paymentMethodId, createdBy: actor.userId,
        }).returning()
      }
      if (received > 0) {
        await tx.insert(moneyMovements).values({
          fromMoneyPlaceId: null, toMoneyPlaceId: place.id, amount: received, occurredOn: key.businessDate,
          sourceType: 'NONCASH_VERIFICATION', sourceId: row.id, createdBy: actor.userId,
        })
      }
      const settlement = await settleFromVerifiedSource(tx, {
        sourceType: 'NONCASH_VERIFICATION', sourceId: row.id, branchId: key.branchId, amount: received,
        heldBy: place.heldBy, reference: noncashReference(row.id), userId: actor.userId, now,
      })
      await audit(tx, actor, 'NONCASH_VERIFY', 'noncash_verifications', String(row.id), existing ? { status: existing.status } : null, {
        expected: computed.expected, received, variance, cause, cashierId: values.cashierId, settlement,
      })
      return { ...row, settlement }
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new DepositError('Baris ini baru saja disimpan pengguna lain — muat ulang', 409)
    throw error
  }
}

/** Koreksi verifikasi non-tunai (Owner/GM): baris lama digantikan, pembalikan perpindahan uang. */
export async function correctNoncashVerification(
  id: number,
  input: { receivedAmount: number; cause?: NoncashCause | null; cashierId?: number | null; note?: string | null; reason: string },
  actor: DepositActor,
) {
  if (!DEPOSIT_CORRECTOR_ROLES.includes(actor.role)) throw new DepositError('Koreksi verifikasi non-tunai hanya oleh Owner/GM', 403)
  const reason = cleanText(input.reason)
  if (!reason) throw new DepositError('Alasan koreksi wajib diisi')
  if (!Number.isInteger(input.receivedAmount) || input.receivedAmount < 0) throw new DepositError('Nominal diterima harus rupiah bulat ≥ 0')
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(noncashVerifications).where(eq(noncashVerifications.id, id)).for('update')
    if (!old) throw new DepositError('Verifikasi tidak ditemukan', 404)
    if (old.status !== 'VERIFIED' || old.supersededAt) throw new DepositError('Hanya verifikasi aktif yang sudah terverifikasi yang bisa dikoreksi', 409)
    const computed = await computeNoncashExpected(tx, {
      shiftId: old.shiftId, branchId: old.branchId, businessDate: old.businessDate, paymentMethodId: old.paymentMethodId,
    })
    const place = await resolveNoncashPlace(tx, old.branchId, old.paymentMethodId)
    const variance = input.receivedAmount - computed.expected
    const cause = variance === 0 ? null : input.cause ?? null
    const note = cleanText(input.note)
    const problem = validateNoncashCause(variance, cause, note)
    if (problem) throw new DepositError(problem)
    if (cause === 'CASHIER_INPUT') await assertShiftCashier(tx, old.shiftId, input.cashierId)

    const now = new Date()
    await tx.update(noncashVerifications).set({ supersededAt: now }).where(eq(noncashVerifications.id, id))
    const [created] = await tx.insert(noncashVerifications).values({
      shiftId: old.shiftId, branchId: old.branchId, businessDate: old.businessDate, paymentMethodId: old.paymentMethodId,
      expectedAmount: computed.expected, moneyPlaceId: place.id, heldBy: place.heldBy, status: 'VERIFIED',
      receivedAmount: input.receivedAmount, variance, cause, cashierId: cause === 'CASHIER_INPUT' ? input.cashierId ?? null : null,
      note: note ? `${note} (koreksi: ${reason})`.slice(0, 255) : `Koreksi: ${reason}`.slice(0, 255),
      verifiedBy: actor.userId, verifiedAt: now, createdBy: actor.userId,
    }).returning()
    await tx.update(noncashVerifications).set({ supersededById: created.id }).where(eq(noncashVerifications.id, id))
    await reverseMovements(tx, 'NONCASH_VERIFICATION', id, actor)
    await reverseSettlements(tx, { sourceType: 'NONCASH_VERIFICATION', sourceId: id, reference: noncashReference(id), reason, userId: actor.userId, now })
    if (input.receivedAmount > 0) {
      await tx.insert(moneyMovements).values({
        fromMoneyPlaceId: null, toMoneyPlaceId: place.id, amount: input.receivedAmount, occurredOn: old.businessDate,
        sourceType: 'NONCASH_VERIFICATION', sourceId: created.id, createdBy: actor.userId,
      })
    }
    const settlement = await settleFromVerifiedSource(tx, {
      sourceType: 'NONCASH_VERIFICATION', sourceId: created.id, branchId: old.branchId, amount: input.receivedAmount,
      heldBy: place.heldBy, reference: noncashReference(created.id), userId: actor.userId, now,
    })
    await audit(tx, actor, 'NONCASH_CORRECT', 'noncash_verifications', String(id),
      { receivedAmount: old.receivedAmount, variance: old.variance, cause: old.cause },
      { supersededBy: created.id, receivedAmount: input.receivedAmount, variance, cause, reason, settlement })
    return { ...created, settlement }
  })
}

/** Dipakai rute lama `/api/bo/shifts/[id]/deposit`: shift dalam alur Setoran tidak diverifikasi cara lama. */
export async function isShiftInDepositFlow(executor: Executor, shiftId: number): Promise<boolean> {
  const settings = await getDepositSettings(executor)
  const [row] = (await executor.execute(sql`
    SELECT
      to_char(COALESCE(s.closed_at, s.force_closed_at, s.opened_at) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS closed_on,
      EXISTS (SELECT 1 FROM petshop.cash_deposit_shifts ds WHERE ds.shift_id = s.id AND ds.released_at IS NULL) AS in_deposit
    FROM petshop.shifts s WHERE s.id = ${shiftId}
  `)) as Record<string, unknown>[]
  if (!row) return false
  return row.in_deposit === true || String(row.closed_on) >= settings.startDate
}

