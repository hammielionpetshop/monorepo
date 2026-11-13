import { alias } from 'drizzle-orm/pg-core'
import {
  db, cashCounts, cashFlowCategories, cashFlowEntries, moneyPlaces, branches, users, auditLogs,
  eq, and, ne, asc, desc, gte, lt, isNull, sql,
} from '@/lib/db'
import { todayWibDate } from '@/lib/payment-date'
import { monthStart } from './cash-flow-rules'
import {
  ADJUSTMENT_CATEGORY, checkAdjustment, checkCount, countFreshness,
  type AdjustmentDirection, type CountFreshness,
} from './cash-count-rules'

/**
 * F2-6e-1 Hitung Kas (spec docs/work/specs/2026-11-12-f2-6e-hitung-kas-design.md §1). Back Office hanya mencatat uang
 * nyata — saldo sistem & selisih dibaca web Finance — sehingga penghitung tidak melihat angka sistem (KEU-36).
 * Penyesuaian = satu catatan Arus Kas kategori sistem "Selisih kas kurang/lebih" yang dibatalkan lewat layar ini.
 */

export class CashCountError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface CashCountActor {
  userId: number
  branchId: number
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

function audit(tx: Tx, actor: CashCountActor, action: string, recordId: number, oldData: unknown, newData: unknown) {
  return tx.insert(auditLogs).values({
    branchId: actor.branchId, userId: actor.userId, action, tableName: 'cash_counts', recordId: String(recordId),
    oldData: oldData == null ? null : JSON.stringify(oldData), newData: newData == null ? null : JSON.stringify(newData),
  })
}

export interface CountPlaceRow {
  id: number
  name: string
  kind: 'CASH' | 'BANK'
  branchName: string
  lastCountedOn: string | null
  lastAmount: number | null
  lastCountedBy: string | null
  freshness: CountFreshness
}

/** Tunai & Rekening aktif dengan hitungan berlaku terakhir — tanpa saldo sistem. */
export async function listCountPlaces(today = todayWibDate()): Promise<CountPlaceRow[]> {
  const places = await db
    .select({ id: moneyPlaces.id, name: moneyPlaces.name, kind: moneyPlaces.kind, branchName: branches.name })
    .from(moneyPlaces)
    .innerJoin(branches, eq(branches.id, moneyPlaces.branchId))
    .where(and(eq(moneyPlaces.isActive, true), ne(moneyPlaces.kind, 'DRAWER')))
    .orderBy(asc(branches.name), asc(moneyPlaces.kind), asc(moneyPlaces.sortOrder), asc(moneyPlaces.name))
  const last = await db
    .selectDistinctOn([cashCounts.moneyPlaceId], {
      moneyPlaceId: cashCounts.moneyPlaceId,
      countedOn: cashCounts.countedOn,
      amount: cashCounts.amount,
      createdByName: users.name,
    })
    .from(cashCounts)
    .leftJoin(users, eq(users.id, cashCounts.createdBy))
    .where(isNull(cashCounts.cancelledAt))
    .orderBy(cashCounts.moneyPlaceId, desc(cashCounts.countedOn))
  const byPlace = new Map(last.map((r) => [r.moneyPlaceId, r]))
  return places.map((p) => {
    const l = byPlace.get(p.id)
    return {
      id: p.id,
      name: p.name,
      kind: p.kind as 'CASH' | 'BANK',
      branchName: p.branchName,
      lastCountedOn: l?.countedOn ?? null,
      lastAmount: l?.amount ?? null,
      lastCountedBy: l?.createdByName ?? null,
      freshness: countFreshness(l?.countedOn ?? null, today),
    }
  })
}

export interface CashCountRow {
  id: number
  moneyPlaceId: number
  placeName: string
  placeKind: string
  branchName: string
  countedOn: string
  amount: number
  note: string | null
  photoUrl: string | null
  createdByName: string | null
  createdAt: string
  cancelledAt: string | null
  cancelReason: string | null
  /** Penyesuaian aktif (catatan Arus Kas belum batal). */
  adjustment: { entryId: number; direction: AdjustmentDirection; amount: number; note: string | null } | null
}

/** Riwayat hitungan satu bulan (YYYY-MM), opsional satu tempat; terbaru dulu. */
export async function listCashCounts(filter: { month: string; moneyPlaceId?: number | null }): Promise<CashCountRow[]> {
  const from = monthStart(filter.month)
  const [y, m] = filter.month.split('-').map(Number)
  const to = monthStart(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`)
  const adj = alias(cashFlowEntries, 'adj')
  const rows = await db
    .select({
      id: cashCounts.id,
      moneyPlaceId: cashCounts.moneyPlaceId,
      placeName: moneyPlaces.name,
      placeKind: moneyPlaces.kind,
      branchName: branches.name,
      countedOn: cashCounts.countedOn,
      amount: cashCounts.amount,
      note: cashCounts.note,
      photoUrl: cashCounts.photoUrl,
      createdByName: users.name,
      createdAt: cashCounts.createdAt,
      cancelledAt: cashCounts.cancelledAt,
      cancelReason: cashCounts.cancelReason,
      adjEntryId: adj.id,
      adjType: adj.type,
      adjAmount: adj.amount,
      adjNote: adj.note,
      adjCancelledAt: adj.cancelledAt,
    })
    .from(cashCounts)
    .innerJoin(moneyPlaces, eq(moneyPlaces.id, cashCounts.moneyPlaceId))
    .innerJoin(branches, eq(branches.id, moneyPlaces.branchId))
    .leftJoin(users, eq(users.id, cashCounts.createdBy))
    .leftJoin(adj, eq(adj.id, cashCounts.adjustmentCashFlowEntryId))
    .where(and(
      gte(cashCounts.countedOn, from),
      lt(cashCounts.countedOn, to),
      filter.moneyPlaceId ? eq(cashCounts.moneyPlaceId, filter.moneyPlaceId) : undefined,
    ))
    .orderBy(desc(cashCounts.countedOn), desc(cashCounts.id))
  return rows.map((r) => ({
    id: r.id,
    moneyPlaceId: r.moneyPlaceId,
    placeName: r.placeName,
    placeKind: r.placeKind,
    branchName: r.branchName,
    countedOn: r.countedOn,
    amount: r.amount,
    note: r.note,
    photoUrl: r.photoUrl,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
    cancelReason: r.cancelReason,
    adjustment: r.adjEntryId && !r.adjCancelledAt
      ? { entryId: r.adjEntryId, direction: r.adjType === 'EXPENSE' ? 'SHORT' : 'OVER', amount: r.adjAmount!, note: r.adjNote }
      : null,
  }))
}

export interface RecordCountInput {
  moneyPlaceId: number
  countedOn: string
  amount: number
  note: string | null
  photoUrl: string | null
}

export async function recordCashCount(input: RecordCountInput, actor: CashCountActor): Promise<{ id: number }> {
  return db.transaction(async (tx) => {
    const [place] = await tx
      .select({ id: moneyPlaces.id, name: moneyPlaces.name, kind: moneyPlaces.kind, isActive: moneyPlaces.isActive })
      .from(moneyPlaces)
      .where(eq(moneyPlaces.id, input.moneyPlaceId))
      .for('update')
      .limit(1)
    const error = checkCount({ place: place ?? null, countedOn: input.countedOn, today: todayWibDate(), amount: input.amount })
    if (error) throw new CashCountError(error, 400)
    const [existing] = await tx
      .select({ id: cashCounts.id })
      .from(cashCounts)
      .where(and(eq(cashCounts.moneyPlaceId, place.id), eq(cashCounts.countedOn, input.countedOn), isNull(cashCounts.cancelledAt)))
      .limit(1)
    if (existing) {
      throw new CashCountError(`"${place.name}" sudah punya hitungan tanggal ini. Bila salah, batalkan dulu dengan alasan lalu catat ulang.`, 409)
    }
    const values = { ...input, createdBy: actor.userId }
    const [created] = await tx.insert(cashCounts).values(values).returning({ id: cashCounts.id })
    await audit(tx, actor, 'CASH_COUNT_RECORD', created.id, null, values)
    return created
  })
}

async function lockCount(tx: Tx, id: number) {
  const [row] = await tx.select().from(cashCounts).where(eq(cashCounts.id, id)).for('update').limit(1)
  if (!row) throw new CashCountError('Hitungan tidak ditemukan', 404)
  return row
}

/** Catatan Arus Kas penyesuaian yang masih aktif, atau null. */
async function activeAdjustment(tx: Tx, entryId: number | null) {
  if (!entryId) return null
  const [entry] = await tx
    .select({ id: cashFlowEntries.id, cancelledAt: cashFlowEntries.cancelledAt })
    .from(cashFlowEntries)
    .where(eq(cashFlowEntries.id, entryId))
    .for('update')
    .limit(1)
  return entry && !entry.cancelledAt ? entry : null
}

function cancelEntry(tx: Tx, entryId: number, actor: CashCountActor, reason: string) {
  return tx
    .update(cashFlowEntries)
    .set({ cancelledAt: sql`now()`, cancelledBy: actor.userId, cancelReason: reason.slice(0, 255) })
    .where(and(eq(cashFlowEntries.id, entryId), isNull(cashFlowEntries.cancelledAt)))
}

/** Batalkan hitungan (Owner/GM); penyesuaian aktifnya ikut dibatalkan. */
export async function cancelCashCount(id: number, reason: string, actor: CashCountActor): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new CashCountError('Alasan pembatalan wajib diisi (minimal 3 huruf)', 400)
  await db.transaction(async (tx) => {
    const row = await lockCount(tx, id)
    if (row.cancelledAt) throw new CashCountError('Hitungan ini sudah dibatalkan', 409)
    const adjustment = await activeAdjustment(tx, row.adjustmentCashFlowEntryId)
    if (adjustment) await cancelEntry(tx, adjustment.id, actor, `Hitung Kas #${id} dibatalkan: ${trimmed}`)
    await tx
      .update(cashCounts)
      .set({ cancelledAt: sql`now()`, cancelledBy: actor.userId, cancelReason: trimmed })
      .where(eq(cashCounts.id, id))
    await audit(tx, actor, 'CASH_COUNT_CANCEL', id, { amount: row.amount, adjustmentEntryId: adjustment?.id ?? null }, { cancelReason: trimmed })
  })
}

export interface AdjustmentInput {
  direction: AdjustmentDirection
  amount: number
  reason: string
}

/** Catat penyesuaian (Owner/GM): satu catatan Arus Kas kategori sistem bertanggal hitungan di tempat itu. */
export async function adjustCashCount(id: number, input: AdjustmentInput, actor: CashCountActor): Promise<{ cashFlowEntryId: number }> {
  const reason = input.reason.trim()
  return db.transaction(async (tx) => {
    const row = await lockCount(tx, id)
    const active = await activeAdjustment(tx, row.adjustmentCashFlowEntryId)
    const error = checkAdjustment({ isCancelled: row.cancelledAt !== null, hasActiveAdjustment: active !== null, amount: input.amount, reason })
    if (error) throw new CashCountError(error, 409)
    const [place] = await tx
      .select({ branchId: moneyPlaces.branchId })
      .from(moneyPlaces)
      .where(eq(moneyPlaces.id, row.moneyPlaceId))
      .limit(1)
    const category = ADJUSTMENT_CATEGORY[input.direction]
    const [cat] = await tx
      .select({ id: cashFlowCategories.id })
      .from(cashFlowCategories)
      .where(and(eq(cashFlowCategories.name, category.name), eq(cashFlowCategories.type, category.type)))
      .limit(1)
    if (!cat) throw new CashCountError(`Kategori "${category.name}" belum ada; jalankan migrasi 0069`, 500)
    const [entry] = await tx
      .insert(cashFlowEntries)
      .values({
        type: category.type,
        categoryId: cat.id,
        branchId: place.branchId,
        amount: input.amount,
        note: `Penyesuaian Hitung Kas #${id}: ${reason}`.slice(0, 255),
        occurredOn: row.countedOn,
        forMonth: monthStart(row.countedOn.slice(0, 7)),
        moneyPlaceId: row.moneyPlaceId,
        createdBy: actor.userId,
      })
      .returning({ id: cashFlowEntries.id })
    await tx.update(cashCounts).set({ adjustmentCashFlowEntryId: entry.id }).where(eq(cashCounts.id, id))
    await audit(tx, actor, 'CASH_COUNT_ADJUST', id, null, { ...input, reason, cashFlowEntryId: entry.id })
    return { cashFlowEntryId: entry.id }
  })
}

/** Batalkan penyesuaian (Owner/GM): catatan Arus Kas-nya bertanda Batal; hitungan bisa disesuaikan lagi. */
export async function cancelCashCountAdjustment(id: number, reason: string, actor: CashCountActor): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new CashCountError('Alasan pembatalan wajib diisi (minimal 3 huruf)', 400)
  await db.transaction(async (tx) => {
    const row = await lockCount(tx, id)
    const active = await activeAdjustment(tx, row.adjustmentCashFlowEntryId)
    if (!active) throw new CashCountError('Hitungan ini tidak punya penyesuaian aktif', 409)
    await cancelEntry(tx, active.id, actor, `Penyesuaian Hitung Kas #${id} dibatalkan: ${trimmed}`)
    await audit(tx, actor, 'CASH_COUNT_ADJUST_CANCEL', id, { cashFlowEntryId: active.id }, { cancelReason: trimmed })
  })
}
