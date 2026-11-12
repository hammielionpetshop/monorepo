import { db, moneyPlaces, moneyPlaceOpeningBalances, users, auditLogs, eq, and, isNull, desc } from '../db'

// F2-6a-1 Saldo awal Tempat Uang: saldo Tunai/Rekening per 1 Nov 2026, titik mulai saldo Finance.
// Spec: docs/work/specs/2026-11-12-f2-6-modul-finance-design.md §2. Tidak diubah; salah = batal lalu isi ulang.

/** Tanggal saldo awal semua Tempat Uang (keputusan owner 2026-11-12). */
export const OPENING_BALANCE_DATE = '2026-11-01'

/** Pengisi & pembatal saldo awal lewat peran, tanpa hak baru (tidak perlu keluar-masuk lagi). */
export const OPENING_BALANCE_ROLES = ['OWNER', 'GM']

export class OpeningBalanceError extends Error {
  constructor(
    readonly code: 'PLACE_NOT_FOUND' | 'DRAWER' | 'ALREADY_SET' | 'NOT_FOUND' | 'ALREADY_CANCELLED',
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'OpeningBalanceError'
  }
}

interface Actor {
  userId: number
  branchId: number
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface OpeningBalanceRow {
  id: number
  moneyPlaceId: number
  asOf: string
  amount: number
  note: string | null
  proofPhotoUrl: string | null
  createdAt: string
  createdByName: string | null
  cancelledAt: string | null
  cancelReason: string | null
}

/** Semua saldo awal (berlaku + batal), terbaru dulu; layar mengelompokkan per Tempat Uang. */
export async function listOpeningBalances(): Promise<OpeningBalanceRow[]> {
  const rows = await db
    .select({
      id: moneyPlaceOpeningBalances.id,
      moneyPlaceId: moneyPlaceOpeningBalances.moneyPlaceId,
      asOf: moneyPlaceOpeningBalances.asOf,
      amount: moneyPlaceOpeningBalances.amount,
      note: moneyPlaceOpeningBalances.note,
      proofPhotoUrl: moneyPlaceOpeningBalances.proofPhotoUrl,
      createdAt: moneyPlaceOpeningBalances.createdAt,
      createdByName: users.name,
      cancelledAt: moneyPlaceOpeningBalances.cancelledAt,
      cancelReason: moneyPlaceOpeningBalances.cancelReason,
    })
    .from(moneyPlaceOpeningBalances)
    .leftJoin(users, eq(users.id, moneyPlaceOpeningBalances.createdBy))
    .orderBy(desc(moneyPlaceOpeningBalances.createdAt), desc(moneyPlaceOpeningBalances.id))
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
  }))
}

function audit(tx: Tx, actor: Actor, action: string, recordId: string, oldData: unknown, newData: unknown) {
  return tx.insert(auditLogs).values({
    branchId: actor.branchId, userId: actor.userId, action, tableName: 'money_place_opening_balances', recordId,
    oldData: oldData == null ? null : JSON.stringify(oldData), newData: newData == null ? null : JSON.stringify(newData),
  })
}

export interface OpeningBalanceInput {
  moneyPlaceId: number
  amount: number
  note: string | null
  proofPhotoUrl: string | null
}

export async function setOpeningBalance(input: OpeningBalanceInput, actor: Actor): Promise<{ id: number }> {
  return db.transaction(async (tx) => {
    // Kunci baris tempat supaya dua pengisian bersamaan tidak lolos bersama (indeks unik tetap penjaga akhir).
    const [place] = await tx
      .select({ id: moneyPlaces.id, name: moneyPlaces.name, kind: moneyPlaces.kind })
      .from(moneyPlaces)
      .where(eq(moneyPlaces.id, input.moneyPlaceId))
      .for('update')
      .limit(1)
    if (!place) throw new OpeningBalanceError('PLACE_NOT_FOUND', 'Tempat Uang tidak ditemukan', 404)
    if (place.kind === 'DRAWER') {
      throw new OpeningBalanceError('DRAWER', 'Laci kasir tidak punya saldo awal; uang laci dihitung per shift', 400)
    }
    const [active] = await tx
      .select({ id: moneyPlaceOpeningBalances.id })
      .from(moneyPlaceOpeningBalances)
      .where(and(eq(moneyPlaceOpeningBalances.moneyPlaceId, place.id), isNull(moneyPlaceOpeningBalances.cancelledAt)))
      .limit(1)
    if (active) {
      throw new OpeningBalanceError(
        'ALREADY_SET',
        `Saldo awal "${place.name}" sudah diisi. Bila salah, batalkan dulu dengan alasan lalu isi ulang.`,
        409,
      )
    }
    const values = {
      moneyPlaceId: place.id,
      asOf: OPENING_BALANCE_DATE,
      amount: input.amount,
      note: input.note,
      proofPhotoUrl: input.proofPhotoUrl,
      createdBy: actor.userId,
    }
    const [created] = await tx.insert(moneyPlaceOpeningBalances).values(values).returning({ id: moneyPlaceOpeningBalances.id })
    await audit(tx, actor, 'OPENING_BALANCE_SET', String(created.id), null, values)
    return created
  })
}

export async function cancelOpeningBalance(id: number, reason: string, actor: Actor): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: moneyPlaceOpeningBalances.id,
        moneyPlaceId: moneyPlaceOpeningBalances.moneyPlaceId,
        amount: moneyPlaceOpeningBalances.amount,
        cancelledAt: moneyPlaceOpeningBalances.cancelledAt,
      })
      .from(moneyPlaceOpeningBalances)
      .where(eq(moneyPlaceOpeningBalances.id, id))
      .for('update')
      .limit(1)
    if (!row) throw new OpeningBalanceError('NOT_FOUND', 'Saldo awal tidak ditemukan', 404)
    if (row.cancelledAt) throw new OpeningBalanceError('ALREADY_CANCELLED', 'Saldo awal ini sudah dibatalkan', 409)
    await tx
      .update(moneyPlaceOpeningBalances)
      .set({ cancelledAt: new Date(), cancelledBy: actor.userId, cancelReason: reason })
      .where(eq(moneyPlaceOpeningBalances.id, id))
    await audit(tx, actor, 'OPENING_BALANCE_CANCEL', String(id), row, { cancelReason: reason })
  })
}
