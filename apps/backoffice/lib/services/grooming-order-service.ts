import {
  db, groomingOrders, groomers, pets, customers, transactions, transactionItems, auditLogs,
  eq, and, or, ne, ilike, inArray, gte, lt, asc, desc, sql,
} from '../db'
import { normalizePhone } from '../phone'

// Jasa grooming J3a: satu baris `grooming_orders` per ekor kucing per kunjungan, menempel ke satu
// baris nota. Uangnya tetap di nota (transaksi biasa) — di sini hanya SIAPA kucingnya, SIAPA
// groomernya, dan sudah diambil atau belum.
// Lihat docs/work/specs/2026-10-11-jasa-grooming-design.md.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const GROOMING_STATUS = { DIKERJAKAN: 'DIKERJAKAN', DIAMBIL: 'DIAMBIL', DIBATALKAN: 'DIBATALKAN' } as const
export type GroomingStatus = (typeof GROOMING_STATUS)[keyof typeof GROOMING_STATUS]

export const GROOMING_CONDITION_MAX = 500

export class GroomingOrderError extends Error {
  constructor(
    readonly code:
      | 'CUSTOMER_REQUIRED' | 'QTY_NOT_ONE' | 'NOT_GROOMING_SERVICE' | 'PET_NOT_FOUND' | 'PET_OWNER_MISMATCH'
      | 'PET_INACTIVE' | 'GROOMER_NOT_FOUND' | 'GROOMER_INACTIVE' | 'CONDITION_REQUIRED' | 'NOT_FOUND' | 'WRONG_STATUS',
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'GroomingOrderError'
  }
}

export interface GroomingLineInput {
  petId: number
  groomerId: number
  condition: string
}

/**
 * Dipanggil TransactionService tepat setelah baris jasa tersimpan, DI DALAM transaksi DB nota —
 * kalau data kucing/groomernya tidak sah, seluruh nota batal (tidak ada nota grooming tanpa data).
 */
export async function attachGroomingOrderInTx(
  tx: Tx,
  params: {
    branchId: number
    transactionId: number
    transactionItemId: number
    sequence: number
    customerId: number | null | undefined
    productId: number
    productName: string
    productKind: string
    qty: number
    cashierId: number | null | undefined
    grooming: GroomingLineInput
  },
): Promise<void> {
  const { grooming } = params
  if (params.productKind !== 'JASA_GROOMING') {
    throw new GroomingOrderError('NOT_GROOMING_SERVICE', `${params.productName} bukan jasa grooming, jadi tidak bisa diberi data kucing`)
  }
  if (!params.customerId) {
    throw new GroomingOrderError('CUSTOMER_REQUIRED', 'Nota grooming wajib memakai pelanggan (pemilik kucing)')
  }
  if (params.qty !== 1) {
    throw new GroomingOrderError('QTY_NOT_ONE', 'Satu baris grooming hanya untuk satu ekor kucing')
  }
  const condition = grooming.condition?.trim() ?? ''
  if (!condition) throw new GroomingOrderError('CONDITION_REQUIRED', 'Kondisi kucing wajib diisi')

  const [pet] = await tx
    .select({ id: pets.id, name: pets.name, customerId: pets.customerId, isActive: pets.isActive })
    .from(pets).where(eq(pets.id, grooming.petId)).limit(1)
  if (!pet) throw new GroomingOrderError('PET_NOT_FOUND', 'Data kucing tidak ditemukan')
  if (pet.customerId !== params.customerId) {
    throw new GroomingOrderError('PET_OWNER_MISMATCH', `${pet.name} bukan kucing milik pelanggan pada nota ini`)
  }
  if (!pet.isActive) throw new GroomingOrderError('PET_INACTIVE', `Data kucing ${pet.name} sudah dinonaktifkan`)

  const [groomer] = await tx
    .select({ id: groomers.id, name: groomers.name, isActive: groomers.isActive })
    .from(groomers).where(eq(groomers.id, grooming.groomerId)).limit(1)
  if (!groomer) throw new GroomingOrderError('GROOMER_NOT_FOUND', 'Groomer tidak ditemukan')
  if (!groomer.isActive) throw new GroomingOrderError('GROOMER_INACTIVE', `Groomer ${groomer.name} sudah dinonaktifkan`)

  await tx.insert(groomingOrders).values({
    branchId: params.branchId,
    transactionId: params.transactionId,
    transactionItemId: params.transactionItemId,
    sequence: params.sequence,
    customerId: params.customerId,
    petId: pet.id,
    productId: params.productId,
    groomerId: groomer.id,
    condition: condition.slice(0, GROOMING_CONDITION_MAX),
    receivedById: params.cashierId ?? null,
  })
}

/** Nota dibatalkan → semua grooming di nota itu ikut batal (bonus groomer ikut gugur). */
export async function cancelGroomingOrdersForVoidInTx(tx: Tx, transactionId: number): Promise<number> {
  const rows = await tx
    .update(groomingOrders)
    .set({ status: GROOMING_STATUS.DIBATALKAN, cancelledAt: new Date(), cancelSource: 'VOID', cancelReason: 'Nota dibatalkan' })
    .where(and(eq(groomingOrders.transactionId, transactionId), ne(groomingOrders.status, GROOMING_STATUS.DIBATALKAN)))
    .returning({ id: groomingOrders.id })
  return rows.length
}

/** Baris jasa diretur (uang dikembalikan) → grooming-nya batal. */
export async function cancelGroomingOrdersForReturInTx(tx: Tx, transactionItemIds: number[], returnNumber: string): Promise<number> {
  if (transactionItemIds.length === 0) return 0
  const rows = await tx
    .update(groomingOrders)
    .set({ status: GROOMING_STATUS.DIBATALKAN, cancelledAt: new Date(), cancelSource: 'RETUR', cancelReason: `Jasa diretur (${returnNumber})` })
    .where(and(inArray(groomingOrders.transactionItemId, transactionItemIds), ne(groomingOrders.status, GROOMING_STATUS.DIBATALKAN)))
    .returning({ id: groomingOrders.id })
  return rows.length
}

/**
 * Retur dibatalkan → grooming yang batal KARENA retur itu pulih ke keadaan sebelumnya.
 * Yang batal karena notanya dibatalkan tidak ikut pulih.
 */
export async function restoreGroomingOrdersAfterReturCancelInTx(tx: Tx, transactionItemIds: number[]): Promise<number> {
  if (transactionItemIds.length === 0) return 0
  const rows = await tx
    .update(groomingOrders)
    .set({
      status: sql`CASE WHEN ${groomingOrders.pickedUpAt} IS NULL THEN 'DIKERJAKAN' ELSE 'DIAMBIL' END`,
      cancelledAt: null,
      cancelSource: null,
      cancelReason: null,
    })
    .where(and(
      inArray(groomingOrders.transactionItemId, transactionItemIds),
      eq(groomingOrders.status, GROOMING_STATUS.DIBATALKAN),
      eq(groomingOrders.cancelSource, 'RETUR'),
    ))
    .returning({ id: groomingOrders.id })
  return rows.length
}

// ── Daftar & serah terima ──────────────────────────────────────────────────

export interface GroomingOrderView {
  id: number
  /** Nomor karcis = nomor nota / urutan kucing di nota. */
  ticketNumber: string
  trxNumber: string
  transactionId: number
  status: GroomingStatus
  receivedAt: Date
  pickedUpAt: Date | null
  cancelledAt: Date | null
  cancelReason: string | null
  condition: string
  serviceName: string
  /** Harga baris jasa sesudah diskon baris. */
  price: number
  pet: { id: number; name: string; species: string; color: string; birthDate: string | null }
  owner: { id: number; name: string; phone: string | null }
  groomer: { id: number; name: string }
  /** Sisa tagihan NOTA (bukan per kucing) — nota grooming dibayar sekaligus. 0 = lunas. */
  debtRemaining: number
  isPaid: boolean
  ticketPrintCount: number
}

const debtRemainingSql = sql<number>`COALESCE((
  SELECT SUM(cd.remaining_amount) FROM petshop.customer_debts cd
  WHERE cd.transaction_id = ${groomingOrders.transactionId} AND cd.status <> 'VOIDED'
), 0)::integer`

const viewSelect = {
  id: groomingOrders.id,
  sequence: groomingOrders.sequence,
  trxNumber: transactions.trxNumber,
  transactionId: groomingOrders.transactionId,
  status: groomingOrders.status,
  receivedAt: groomingOrders.receivedAt,
  pickedUpAt: groomingOrders.pickedUpAt,
  cancelledAt: groomingOrders.cancelledAt,
  cancelReason: groomingOrders.cancelReason,
  condition: groomingOrders.condition,
  serviceName: transactionItems.productName,
  price: transactionItems.totalPrice,
  petId: pets.id,
  petName: pets.name,
  petSpecies: pets.species,
  petColor: pets.color,
  petBirthDate: pets.birthDate,
  ownerId: customers.id,
  ownerName: customers.name,
  ownerPhone: customers.phone,
  groomerId: groomers.id,
  groomerName: groomers.name,
  debtRemaining: debtRemainingSql,
  ticketPrintCount: groomingOrders.ticketPrintCount,
}

function baseQuery(executor: Tx | typeof db = db) {
  return executor
    .select(viewSelect)
    .from(groomingOrders)
    .innerJoin(transactions, eq(transactions.id, groomingOrders.transactionId))
    .innerJoin(transactionItems, eq(transactionItems.id, groomingOrders.transactionItemId))
    .innerJoin(pets, eq(pets.id, groomingOrders.petId))
    .innerJoin(customers, eq(customers.id, groomingOrders.customerId))
    .innerJoin(groomers, eq(groomers.id, groomingOrders.groomerId))
}

type ViewRow = Awaited<ReturnType<typeof baseQuery>>[number]

function toView(r: ViewRow): GroomingOrderView {
  const debtRemaining = Number(r.debtRemaining ?? 0)
  return {
    id: r.id,
    ticketNumber: `${r.trxNumber}/${r.sequence}`,
    trxNumber: r.trxNumber,
    transactionId: r.transactionId,
    status: r.status as GroomingStatus,
    receivedAt: r.receivedAt,
    pickedUpAt: r.pickedUpAt,
    cancelledAt: r.cancelledAt,
    cancelReason: r.cancelReason,
    condition: r.condition,
    serviceName: r.serviceName ?? 'Jasa grooming',
    price: r.price,
    pet: { id: r.petId, name: r.petName, species: r.petSpecies, color: r.petColor, birthDate: r.petBirthDate },
    owner: { id: r.ownerId, name: r.ownerName, phone: r.ownerPhone },
    groomer: { id: r.groomerId, name: r.groomerName },
    debtRemaining,
    isPaid: debtRemaining <= 0,
    ticketPrintCount: r.ticketPrintCount,
  }
}

export interface GroomingListFilters {
  branchId: number
  /** AKTIF = kucing masih di toko; SELESAI = sudah diambil atau dibatalkan (riwayat). */
  view: 'AKTIF' | 'SELESAI'
  q?: string
  /** Batas tanggal (berdasarkan waktu diterima), hanya untuk SELESAI. */
  from?: Date
  to?: Date
  limit?: number
}

export async function listGroomingOrders(filters: GroomingListFilters): Promise<GroomingOrderView[]> {
  const q = filters.q?.trim()
  const digits = normalizePhone(q)
  const phoneNormalized = sql<string>`regexp_replace(regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g'), '^62', '0')`
  const rows = await baseQuery()
    .where(and(
      eq(groomingOrders.branchId, filters.branchId),
      filters.view === 'AKTIF'
        ? eq(groomingOrders.status, GROOMING_STATUS.DIKERJAKAN)
        : ne(groomingOrders.status, GROOMING_STATUS.DIKERJAKAN),
      filters.view === 'SELESAI' && filters.from ? gte(groomingOrders.receivedAt, filters.from) : undefined,
      filters.view === 'SELESAI' && filters.to ? lt(groomingOrders.receivedAt, filters.to) : undefined,
      q
        ? or(
            ilike(pets.name, `%${q}%`),
            ilike(customers.name, `%${q}%`),
            ilike(transactions.trxNumber, `%${q}%`),
            digits.length >= 3 ? sql`${phoneNormalized} LIKE ${`%${digits}%`}` : undefined,
          )
        : undefined,
    ))
    .orderBy(
      filters.view === 'AKTIF' ? asc(groomingOrders.receivedAt) : desc(sql`COALESCE(${groomingOrders.pickedUpAt}, ${groomingOrders.cancelledAt}, ${groomingOrders.receivedAt})`),
      asc(groomingOrders.id),
    )
    .limit(Math.min(filters.limit ?? 200, 500))
  return rows.map(toView)
}

/** Semua grooming pada satu nota (untuk mencetak karcis sesudah nota tersimpan). */
export async function listGroomingOrdersOfTransaction(transactionId: number, branchId: number): Promise<GroomingOrderView[]> {
  const rows = await baseQuery()
    .where(and(eq(groomingOrders.transactionId, transactionId), eq(groomingOrders.branchId, branchId)))
    .orderBy(asc(groomingOrders.sequence))
  return rows.map(toView)
}

interface Actor {
  userId: number
  branchId: number
}

async function lockOrder(tx: Tx, id: number, branchId: number) {
  const [order] = await tx
    .select({ id: groomingOrders.id, status: groomingOrders.status, ticketPrintCount: groomingOrders.ticketPrintCount })
    .from(groomingOrders)
    .where(and(eq(groomingOrders.id, id), eq(groomingOrders.branchId, branchId)))
    .for('update')
    .limit(1)
  if (!order) throw new GroomingOrderError('NOT_FOUND', 'Data grooming tidak ditemukan di cabang ini', 404)
  return order
}

/**
 * Kucing diambil pemiliknya. Boleh walau notanya belum lunas (keputusan owner): kucingnya memang
 * sudah tidak di toko, penagihan tetap lewat Piutang — daftar menandainya BELUM LUNAS.
 */
export async function markGroomingPickedUp(id: number, actor: Actor): Promise<GroomingOrderView> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, id, actor.branchId)
    if (order.status !== GROOMING_STATUS.DIKERJAKAN) {
      throw new GroomingOrderError(
        'WRONG_STATUS',
        order.status === GROOMING_STATUS.DIAMBIL ? 'Kucing ini sudah ditandai diambil' : 'Grooming ini sudah dibatalkan',
        409,
      )
    }
    const now = new Date()
    await tx
      .update(groomingOrders)
      .set({ status: GROOMING_STATUS.DIAMBIL, pickedUpAt: now, pickedUpById: actor.userId })
      .where(eq(groomingOrders.id, id))
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'GROOMING_PICKED_UP', tableName: 'grooming_orders',
      recordId: String(id), oldData: JSON.stringify({ status: order.status }), newData: JSON.stringify({ status: GROOMING_STATUS.DIAMBIL, pickedUpAt: now }),
    })
    const [row] = await baseQuery(tx).where(eq(groomingOrders.id, id))
    return toView(row)
  })
}

/** Catat karcis dicetak; kembalian > 1 berarti cetak ulang. */
export async function recordGroomingTicketPrint(id: number, actor: Actor): Promise<number> {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, id, actor.branchId)
    const next = order.ticketPrintCount + 1
    await tx.update(groomingOrders).set({ ticketPrintCount: next }).where(eq(groomingOrders.id, id))
    return next
  })
}
