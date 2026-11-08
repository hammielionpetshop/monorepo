import { alias } from 'drizzle-orm/pg-core'
import { db, moneyTransfers, moneyMovements, moneyPlaces, users, eq, and, desc, gte, lte, isNull, sql } from '@/lib/db'
import { todayWibDate } from '@/lib/payment-date'
import { checkCancel, checkTransfer } from './cash-flow-rules'

/**
 * F2-4c Pindah Dana (spec docs/work/specs/2026-11-09-f2-4-supplier-arus-kas-design.md §4).
 * Satu baris money_transfers + satu baris money_movements (sumber TRANSFER) dalam satu transaksi DB.
 * Batal: isi pembatalan + baris pembalikan bernilai negatif (money_movements tidak pernah diubah).
 */

export class MoneyTransferError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface TransferActor {
  userId: number
  isOwner: boolean
  canCancelAny: boolean
}

export interface TransferInput {
  fromMoneyPlaceId: number
  toMoneyPlaceId: number
  amount: number
  occurredOn: string
  note: string | null
  proofPhotoUrl: string | null
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function placeFor(tx: Tx, id: number) {
  const [row] = await tx
    .select({ id: moneyPlaces.id, kind: moneyPlaces.kind, isActive: moneyPlaces.isActive })
    .from(moneyPlaces)
    .where(eq(moneyPlaces.id, id))
    .limit(1)
  return row ?? null
}

export async function createMoneyTransfer(input: TransferInput, actor: TransferActor) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new MoneyTransferError('Jumlah harus lebih dari 0', 400)
  return db.transaction(async (tx) => {
    const error = checkTransfer({
      from: await placeFor(tx, input.fromMoneyPlaceId),
      to: await placeFor(tx, input.toMoneyPlaceId),
      occurredOn: input.occurredOn,
      isOwner: actor.isOwner,
      today: todayWibDate(),
    })
    if (error) throw new MoneyTransferError(error, 400)

    const [transfer] = await tx
      .insert(moneyTransfers)
      .values({
        fromMoneyPlaceId: input.fromMoneyPlaceId,
        toMoneyPlaceId: input.toMoneyPlaceId,
        amount: input.amount,
        occurredOn: input.occurredOn,
        note: input.note,
        proofPhotoUrl: input.proofPhotoUrl,
        createdBy: actor.userId,
      })
      .returning()
    await tx.insert(moneyMovements).values({
      fromMoneyPlaceId: input.fromMoneyPlaceId,
      toMoneyPlaceId: input.toMoneyPlaceId,
      amount: input.amount,
      occurredOn: input.occurredOn,
      sourceType: 'TRANSFER',
      sourceId: transfer.id,
      createdBy: actor.userId,
    })
    return transfer
  })
}

const createdOnWib = sql<string>`to_char(${moneyTransfers.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`

export async function cancelMoneyTransfer(id: number, reason: string, actor: TransferActor): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new MoneyTransferError('Alasan pembatalan wajib diisi (minimal 3 huruf)', 400)
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ createdBy: moneyTransfers.createdBy, createdOn: createdOnWib, cancelledAt: moneyTransfers.cancelledAt })
      .from(moneyTransfers)
      .where(eq(moneyTransfers.id, id))
      .for('update')
      .limit(1)
    if (!row) throw new MoneyTransferError('Catatan Pindah Dana tidak ditemukan', 404)
    const error = checkCancel({
      isCancelled: row.cancelledAt !== null,
      isSystemCategory: false,
      createdBy: row.createdBy,
      createdOn: row.createdOn,
      actorId: actor.userId,
      actorCanCancelAny: actor.canCancelAny,
      today: todayWibDate(),
    })
    if (error) throw new MoneyTransferError(error, 409)

    await tx
      .update(moneyTransfers)
      .set({ cancelledAt: sql`now()`, cancelledBy: actor.userId, cancelReason: trimmed })
      .where(and(eq(moneyTransfers.id, id), isNull(moneyTransfers.cancelledAt)))

    const [movement] = await tx
      .select()
      .from(moneyMovements)
      .where(and(eq(moneyMovements.sourceType, 'TRANSFER'), eq(moneyMovements.sourceId, id), isNull(moneyMovements.reversalOfId)))
      .limit(1)
    if (movement) {
      await tx.insert(moneyMovements).values({
        fromMoneyPlaceId: movement.fromMoneyPlaceId,
        toMoneyPlaceId: movement.toMoneyPlaceId,
        amount: -movement.amount,
        occurredOn: todayWibDate(),
        sourceType: 'TRANSFER',
        sourceId: id,
        reversalOfId: movement.id,
        createdBy: actor.userId,
      })
    }
  })
}

export interface TransferListFilter {
  from?: string
  to?: string
  includeCancelled?: boolean
}

export async function listMoneyTransfers(filter: TransferListFilter, actor: TransferActor) {
  const fromPlace = alias(moneyPlaces, 'from_place')
  const toPlace = alias(moneyPlaces, 'to_place')
  const canceller = alias(users, 'canceller')
  const conditions = []
  if (filter.from) conditions.push(gte(moneyTransfers.occurredOn, filter.from))
  if (filter.to) conditions.push(lte(moneyTransfers.occurredOn, filter.to))
  if (!filter.includeCancelled) conditions.push(isNull(moneyTransfers.cancelledAt))
  const rows = await db
    .select({
      id: moneyTransfers.id,
      fromMoneyPlaceId: moneyTransfers.fromMoneyPlaceId,
      fromName: fromPlace.name,
      toMoneyPlaceId: moneyTransfers.toMoneyPlaceId,
      toName: toPlace.name,
      amount: moneyTransfers.amount,
      occurredOn: moneyTransfers.occurredOn,
      note: moneyTransfers.note,
      proofPhotoUrl: moneyTransfers.proofPhotoUrl,
      createdBy: moneyTransfers.createdBy,
      createdByName: users.name,
      createdAt: moneyTransfers.createdAt,
      createdOn: createdOnWib,
      cancelledAt: moneyTransfers.cancelledAt,
      cancelledByName: canceller.name,
      cancelReason: moneyTransfers.cancelReason,
    })
    .from(moneyTransfers)
    .innerJoin(fromPlace, eq(fromPlace.id, moneyTransfers.fromMoneyPlaceId))
    .innerJoin(toPlace, eq(toPlace.id, moneyTransfers.toMoneyPlaceId))
    .leftJoin(users, eq(users.id, moneyTransfers.createdBy))
    .leftJoin(canceller, eq(canceller.id, moneyTransfers.cancelledBy))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(moneyTransfers.occurredOn), desc(moneyTransfers.id))
    .limit(500)
  const today = todayWibDate()
  return rows.map(({ createdOn, ...r }) => ({
    ...r,
    canCancel:
      checkCancel({
        isCancelled: r.cancelledAt !== null,
        isSystemCategory: false,
        createdBy: r.createdBy,
        createdOn,
        actorId: actor.userId,
        actorCanCancelAny: actor.canCancelAny,
        today,
      }) === null,
  }))
}
