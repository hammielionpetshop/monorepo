import {
  db, groomingHolds, groomers, pets, customers, products, auditLogs,
  eq, and, inArray, asc, desc, gte, lt,
} from '../db'
import type { ManualDiscountEntry } from '../manual-discount'
import { phoneSearchDigits } from '../phone'
import { GroomingOrderError, GROOMING_CONDITION_MAX, DELIVERY_ADDRESS_MAX, holdTicketNumber } from './grooming-order-service'

// Grooming Ditahan — kucing diterima & karcis dicetak dulu, nota menyusul.
// Lihat docs/work/specs/2026-11-05-grooming-tahan-design.md.
// Tidak ada uang di sini. `grooming_orders` tetap hanya lahir bersama nota (transaction-service
// memanggil lockGroomingHoldForNotaInTx + markGroomingHoldConvertedInTx di transaksi DB nota).

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const HOLD_STATUS = { DITAHAN: 'DITAHAN', DIBUATKAN_NOTA: 'DIBUATKAN_NOTA', DIBATALKAN: 'DIBATALKAN' } as const
export type HoldStatus = (typeof HOLD_STATUS)[keyof typeof HOLD_STATUS]

export const HOLD_CANCEL_REASON_MAX = 300

export interface HoldLineData {
  petId: number
  productId: number
  groomerId: number
  condition: string
  discount?: ManualDiscountEntry | null
}

export interface HoldDeliveryData {
  courierId: number
  address: string
  qty: number
  free: boolean
}

export interface CreateHoldInput {
  customerId: number
  lines: HoldLineData[]
  delivery: HoldDeliveryData | null
}

interface Actor {
  userId: number
  branchId: number
}

/** Satu tahanan beserta kucing-kucingnya (satu baris per ekor, urut = urutan karcis). */
export interface GroomingHoldView {
  id: number
  status: HoldStatus
  heldAt: Date
  cancelledAt: Date | null
  cancelReason: string | null
  ticketPrintCount: number
  owner: { id: number; name: string; phone: string | null; tierType: string }
  lines: {
    sequence: number
    ticketNumber: string
    pet: { id: number; name: string; species: string; color: string; birthDate: string | null }
    productId: number
    serviceName: string
    groomer: { id: number; name: string }
    condition: string
    discount: ManualDiscountEntry | null
  }[]
  delivery: { courier: { id: number; name: string }; address: string; qty: number; free: boolean } | null
}

// ── Pemeriksaan isi tahanan (aturan yang sama dengan nota grooming) ──────────────────────────

async function validateHoldInTx(tx: Tx, input: CreateHoldInput): Promise<{ lines: HoldLineData[]; delivery: HoldDeliveryData | null }> {
  if (input.lines.length === 0) throw new GroomingOrderError('GROOMING_DATA_REQUIRED', 'Belum ada kucing di daftar')
  const petIds = input.lines.map((l) => l.petId)
  if (new Set(petIds).size !== petIds.length) {
    throw new GroomingOrderError('HOLD_MISMATCH', 'Satu kucing hanya boleh satu kali dalam satu tahanan')
  }

  const [owner] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, input.customerId)).limit(1)
  if (!owner) throw new GroomingOrderError('CUSTOMER_REQUIRED', 'Pemilik kucing tidak ditemukan')

  const petRows = await tx
    .select({ id: pets.id, name: pets.name, customerId: pets.customerId, isActive: pets.isActive })
    .from(pets).where(inArray(pets.id, petIds))
  const productRows = await tx
    .select({ id: products.id, name: products.name, productKind: products.productKind, isActive: products.isActive })
    .from(products).where(inArray(products.id, [...new Set(input.lines.map((l) => l.productId))]))
  const groomerRows = await tx
    .select({ id: groomers.id, name: groomers.name, isActive: groomers.isActive, isGroomer: groomers.isGroomer })
    .from(groomers).where(inArray(groomers.id, [...new Set(input.lines.map((l) => l.groomerId))]))

  const lines = input.lines.map((line) => {
    const pet = petRows.find((p) => p.id === line.petId)
    if (!pet) throw new GroomingOrderError('PET_NOT_FOUND', 'Data kucing tidak ditemukan')
    if (pet.customerId !== input.customerId) {
      throw new GroomingOrderError('PET_OWNER_MISMATCH', `${pet.name} bukan kucing milik pemilik ini`)
    }
    if (!pet.isActive) throw new GroomingOrderError('PET_INACTIVE', `Data kucing ${pet.name} sudah dinonaktifkan`)
    const product = productRows.find((p) => p.id === line.productId)
    if (!product || product.productKind !== 'JASA_GROOMING' || !product.isActive) {
      throw new GroomingOrderError('NOT_GROOMING_SERVICE', `Jasa untuk ${pet.name} bukan jasa grooming yang aktif`)
    }
    const groomer = groomerRows.find((g) => g.id === line.groomerId)
    if (!groomer) throw new GroomingOrderError('GROOMER_NOT_FOUND', 'Groomer tidak ditemukan')
    if (!groomer.isActive) throw new GroomingOrderError('GROOMER_INACTIVE', `Groomer ${groomer.name} sudah dinonaktifkan`)
    if (!groomer.isGroomer) throw new GroomingOrderError('GROOMER_ROLE', `${groomer.name} tidak terdaftar sebagai groomer`)
    const condition = line.condition?.trim() ?? ''
    if (!condition) throw new GroomingOrderError('CONDITION_REQUIRED', `Kondisi ${pet.name} wajib diisi`)
    return {
      petId: line.petId,
      productId: line.productId,
      groomerId: line.groomerId,
      condition: condition.slice(0, GROOMING_CONDITION_MAX),
      ...(line.discount ? { discount: line.discount } : {}),
    }
  })

  let delivery: HoldDeliveryData | null = null
  if (input.delivery) {
    const address = input.delivery.address?.trim() ?? ''
    if (!address) throw new GroomingOrderError('ADDRESS_REQUIRED', 'Alamat delivery wajib diisi')
    if (!Number.isInteger(input.delivery.qty) || input.delivery.qty <= 0) {
      throw new GroomingOrderError('FREE_SHIPPING_MISMATCH', 'Qty ongkos kirim harus angka bulat lebih dari 0')
    }
    const [courier] = await tx
      .select({ id: groomers.id, name: groomers.name, isActive: groomers.isActive, isCourier: groomers.isCourier })
      .from(groomers).where(eq(groomers.id, input.delivery.courierId)).limit(1)
    if (!courier) throw new GroomingOrderError('COURIER_NOT_FOUND', 'Pengantar tidak ditemukan')
    if (!courier.isActive) throw new GroomingOrderError('COURIER_INACTIVE', `Pengantar ${courier.name} sudah dinonaktifkan`)
    if (!courier.isCourier) throw new GroomingOrderError('COURIER_ROLE', `${courier.name} tidak terdaftar sebagai pengantar`)
    delivery = { courierId: courier.id, address: address.slice(0, DELIVERY_ADDRESS_MAX), qty: input.delivery.qty, free: input.delivery.free === true }
  }
  return { lines, delivery }
}

// ── Tampilan ────────────────────────────────────────────────────────────────────────────────

type HoldRow = typeof groomingHolds.$inferSelect

async function toViews(executor: Tx | typeof db, rows: HoldRow[]): Promise<GroomingHoldView[]> {
  if (rows.length === 0) return []
  const allLines = rows.flatMap((r) => r.lines as HoldLineData[])
  const deliveries = rows.map((r) => r.delivery as HoldDeliveryData | null).filter((d): d is HoldDeliveryData => d != null)
  const petIds = [...new Set(allLines.map((l) => l.petId))]
  const productIds = [...new Set(allLines.map((l) => l.productId))]
  const personIds = [...new Set([...allLines.map((l) => l.groomerId), ...deliveries.map((d) => d.courierId)])]
  const customerIds = [...new Set(rows.map((r) => r.customerId))]

  const [petRows, productRows, personRows, ownerRows] = await Promise.all([
    executor.select({ id: pets.id, name: pets.name, species: pets.species, color: pets.color, birthDate: pets.birthDate }).from(pets).where(inArray(pets.id, petIds)),
    executor.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds)),
    executor.select({ id: groomers.id, name: groomers.name }).from(groomers).where(inArray(groomers.id, personIds)),
    executor
      .select({ id: customers.id, name: customers.name, phone: customers.phone, tierType: customers.defaultTierType })
      .from(customers).where(inArray(customers.id, customerIds)),
  ])
  const petMap = new Map(petRows.map((p) => [p.id, p]))
  const productMap = new Map(productRows.map((p) => [p.id, p.name]))
  const personMap = new Map(personRows.map((p) => [p.id, p.name]))
  const ownerMap = new Map(ownerRows.map((o) => [o.id, o]))

  return rows.map((r) => {
    const owner = ownerMap.get(r.customerId)
    const delivery = r.delivery as HoldDeliveryData | null
    return {
      id: r.id,
      status: r.status as HoldStatus,
      heldAt: r.heldAt,
      cancelledAt: r.cancelledAt,
      cancelReason: r.cancelReason,
      ticketPrintCount: r.ticketPrintCount,
      owner: { id: r.customerId, name: owner?.name ?? '-', phone: owner?.phone ?? null, tierType: owner?.tierType ?? 'RETAIL' },
      lines: (r.lines as HoldLineData[]).map((l, index) => {
        const pet = petMap.get(l.petId)
        return {
          sequence: index + 1,
          ticketNumber: holdTicketNumber(r.id, index + 1),
          pet: { id: l.petId, name: pet?.name ?? '-', species: pet?.species ?? '', color: pet?.color ?? '', birthDate: pet?.birthDate ?? null },
          productId: l.productId,
          serviceName: productMap.get(l.productId) ?? 'Jasa grooming',
          groomer: { id: l.groomerId, name: personMap.get(l.groomerId) ?? '-' },
          condition: l.condition,
          discount: l.discount ?? null,
        }
      }),
      delivery: delivery
        ? { courier: { id: delivery.courierId, name: personMap.get(delivery.courierId) ?? '-' }, address: delivery.address, qty: delivery.qty, free: delivery.free }
        : null,
    }
  })
}

export interface HoldListFilters {
  branchId: number
  /** AKTIF = masih ditahan (kucing di toko, belum bernota); SELESAI = tahanan yang dibatalkan. */
  view: 'AKTIF' | 'SELESAI'
  q?: string
  from?: Date
  to?: Date
}

export async function listGroomingHolds(filters: HoldListFilters): Promise<GroomingHoldView[]> {
  const rows = await db
    .select()
    .from(groomingHolds)
    .where(and(
      eq(groomingHolds.branchId, filters.branchId),
      eq(groomingHolds.status, filters.view === 'AKTIF' ? HOLD_STATUS.DITAHAN : HOLD_STATUS.DIBATALKAN),
      filters.view === 'SELESAI' && filters.from ? gte(groomingHolds.heldAt, filters.from) : undefined,
      filters.view === 'SELESAI' && filters.to ? lt(groomingHolds.heldAt, filters.to) : undefined,
    ))
    .orderBy(filters.view === 'AKTIF' ? asc(groomingHolds.heldAt) : desc(groomingHolds.cancelledAt), asc(groomingHolds.id))
    .limit(300)
  const views = await toViews(db, rows)
  const q = filters.q?.trim().toLowerCase()
  if (!q) return views
  const digits = phoneSearchDigits(q)
  return views.filter((h) =>
    h.owner.name.toLowerCase().includes(q)
    || h.lines.some((l) => l.pet.name.toLowerCase().includes(q) || l.ticketNumber.toLowerCase().includes(q))
    || (digits.length >= 3 && (h.owner.phone ?? '').replace(/\D/g, '').replace(/^62/, '0').includes(digits)),
  )
}

async function viewOf(executor: Tx | typeof db, id: number): Promise<GroomingHoldView> {
  const rows = await executor.select().from(groomingHolds).where(eq(groomingHolds.id, id))
  const [view] = await toViews(executor, rows)
  return view
}

// ── Perintah ────────────────────────────────────────────────────────────────────────────────

/** Simpan tahanan. Tidak butuh shift — tidak ada uang. */
export async function createGroomingHold(input: CreateHoldInput, actor: Actor): Promise<GroomingHoldView> {
  return db.transaction(async (tx) => {
    const { lines, delivery } = await validateHoldInTx(tx, input)
    const [row] = await tx
      .insert(groomingHolds)
      .values({ branchId: actor.branchId, customerId: input.customerId, lines, delivery, heldById: actor.userId })
      .returning({ id: groomingHolds.id })
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'GROOMING_HOLD_CREATE', tableName: 'grooming_holds',
      recordId: String(row.id), newData: JSON.stringify({ customerId: input.customerId, lines, delivery }),
    })
    return viewOf(tx, row.id)
  })
}

async function lockHold(tx: Tx, id: number, branchId: number) {
  const [hold] = await tx
    .select()
    .from(groomingHolds)
    .where(and(eq(groomingHolds.id, id), eq(groomingHolds.branchId, branchId)))
    .for('update')
    .limit(1)
  if (!hold) throw new GroomingOrderError('NOT_FOUND', 'Tahanan grooming tidak ditemukan di cabang ini', 404)
  return hold
}

function closedMessage(status: string): string {
  return status === HOLD_STATUS.DIBUATKAN_NOTA ? 'Tahanan ini sudah dibuatkan nota' : 'Tahanan ini sudah dibatalkan'
}

/** Catat karcis tahanan dicetak; kembalian > 1 berarti cetak ulang. */
export async function recordHoldTicketPrint(id: number, actor: Actor): Promise<number> {
  return db.transaction(async (tx) => {
    const hold = await lockHold(tx, id, actor.branchId)
    if (hold.status === HOLD_STATUS.DIBATALKAN) throw new GroomingOrderError('WRONG_STATUS', closedMessage(hold.status), 409)
    const next = hold.ticketPrintCount + 1
    await tx.update(groomingHolds).set({ ticketPrintCount: next }).where(eq(groomingHolds.id, id))
    return next
  })
}

export async function cancelGroomingHold(id: number, reason: string, actor: Actor): Promise<GroomingHoldView> {
  const trimmed = reason.trim()
  if (!trimmed) throw new GroomingOrderError('REASON_REQUIRED', 'Alasan pembatalan wajib diisi')
  return db.transaction(async (tx) => {
    const hold = await lockHold(tx, id, actor.branchId)
    if (hold.status !== HOLD_STATUS.DITAHAN) throw new GroomingOrderError('WRONG_STATUS', closedMessage(hold.status), 409)
    const now = new Date()
    await tx
      .update(groomingHolds)
      .set({ status: HOLD_STATUS.DIBATALKAN, cancelledAt: now, cancelledById: actor.userId, cancelReason: trimmed.slice(0, HOLD_CANCEL_REASON_MAX) })
      .where(eq(groomingHolds.id, id))
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'GROOMING_HOLD_CANCEL', tableName: 'grooming_holds',
      recordId: String(id), oldData: JSON.stringify({ status: hold.status }), newData: JSON.stringify({ status: HOLD_STATUS.DIBATALKAN, reason: trimmed }),
    })
    return viewOf(tx, id)
  })
}

// ── Dipanggil transaction-service di dalam transaksi DB nota ────────────────────────────────

interface NotaItem {
  productId: number | string
  grooming?: { petId: number; groomerId: number; condition: string; holdId?: number | null } | null
  delivery?: { courierId: number } | null
}

export interface LockedHold {
  id: number
  heldAt: Date
  heldById: number | null
}

/**
 * Bila baris grooming nota membawa `holdId`: kunci tahanannya dan pastikan isi nota = isi karcis
 * (kucing, jasa, groomer, kondisi, urutan, pengantar). Dua kasir yang menekan Buat Nota bersamaan
 * menjadi berurutan karena FOR UPDATE; yang kedua mendapati status bukan DITAHAN lalu ditolak.
 */
export async function lockGroomingHoldForNotaInTx(
  tx: Tx,
  params: { items: NotaItem[]; branchId: number; customerId: number | null | undefined },
): Promise<LockedHold | null> {
  const groomingItems = params.items.filter((i) => i.grooming != null)
  const holdIds = [...new Set(groomingItems.map((i) => i.grooming?.holdId).filter((v): v is number => v != null))]
  if (holdIds.length === 0) return null
  if (holdIds.length > 1 || groomingItems.some((i) => i.grooming?.holdId == null)) {
    throw new GroomingOrderError('HOLD_MISMATCH', 'Satu nota hanya untuk satu tahanan grooming. Selesaikan tahanan lain di nota terpisah.')
  }
  const hold = await lockHold(tx, holdIds[0], params.branchId)
  if (hold.status !== HOLD_STATUS.DITAHAN) throw new GroomingOrderError('HOLD_CLOSED', closedMessage(hold.status), 409)
  if (hold.customerId !== params.customerId) {
    throw new GroomingOrderError('HOLD_MISMATCH', 'Pelanggan nota harus pemilik kucing pada tahanan ini')
  }
  const holdLines = hold.lines as HoldLineData[]
  const sameLines = holdLines.length === groomingItems.length && holdLines.every((line, index) => {
    const item = groomingItems[index]
    return Number(item.productId) === line.productId
      && item.grooming?.petId === line.petId
      && item.grooming?.groomerId === line.groomerId
      && (item.grooming?.condition ?? '').trim() === line.condition
  })
  const holdDelivery = hold.delivery as HoldDeliveryData | null
  const deliveryItem = params.items.find((i) => i.delivery != null)
  const sameDelivery = holdDelivery ? deliveryItem?.delivery?.courierId === holdDelivery.courierId : !deliveryItem
  if (!sameLines || !sameDelivery) {
    throw new GroomingOrderError('HOLD_MISMATCH', 'Isi nota berbeda dengan karcis tahanan. Muat ulang daftar lalu tekan Buat Nota lagi.')
  }
  return { id: hold.id, heldAt: hold.heldAt, heldById: hold.heldById }
}

export async function markGroomingHoldConvertedInTx(
  tx: Tx,
  params: { holdId: number; transactionId: number; branchId: number; cashierId: number | null | undefined },
): Promise<void> {
  await tx
    .update(groomingHolds)
    .set({ status: HOLD_STATUS.DIBUATKAN_NOTA, transactionId: params.transactionId, convertedAt: new Date() })
    .where(eq(groomingHolds.id, params.holdId))
  await tx.insert(auditLogs).values({
    branchId: params.branchId, userId: params.cashierId ?? null, action: 'GROOMING_HOLD_CONVERT', tableName: 'grooming_holds',
    recordId: String(params.holdId), oldData: JSON.stringify({ status: HOLD_STATUS.DITAHAN }),
    newData: JSON.stringify({ status: HOLD_STATUS.DIBUATKAN_NOTA, transactionId: params.transactionId }),
  })
}
