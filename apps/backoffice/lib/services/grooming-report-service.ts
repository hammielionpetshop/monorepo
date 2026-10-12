import { alias } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  db, groomingOrders, groomingGroomerChanges, serviceDeliveries, groomers, pets, customers, transactions, transactionItems,
  branches, users, auditLogs,
  eq, and, or, ilike, inArray, gte, lt, asc, desc, sql,
} from '../db'
import { phoneSearchDigits } from '../phone'
import { bonusOf, netLineAmount, COURIER_BONUS_PERCENT, GROOMER_BONUS_PERCENT } from '../grooming-bonus'
import { GroomingOrderError, GROOMING_STATUS, DELIVERY_STATUS } from './grooming-order-service'

// Jasa grooming J4: Riwayat Grooming (Back Office), laporan jasa & bonus, dan Ganti Groomer.
// Tidak ada jalur uang baru: semua angka dibaca dari nota (transaksi) yang sudah ada.
// Lihat docs/work/specs/2026-10-11-jasa-grooming-design.md.

export const GROOMER_CHANGE_REASON_MIN = 5
export const GROOMER_CHANGE_REASON_MAX = 300

export interface GroomerChangeView {
  at: Date
  by: string | null
  from: string
  to: string
  reason: string
}

export interface GroomingHistoryRow {
  id: number
  ticketNumber: string
  trxNumber: string
  transactionId: number
  branchId: number
  branchName: string
  status: string
  receivedAt: Date
  pickedUpAt: Date | null
  cancelledAt: Date | null
  cancelReason: string | null
  condition: string
  serviceName: string
  /** Harga baris jasa di nota (sesudah diskon baris). */
  price: number
  /** Harga sesudah bagian diskon nota — dasar bonus. */
  netPrice: number
  /** Bonus groomer; 0 bila grooming dibatalkan. */
  bonus: number
  petName: string
  petSpecies: string
  ownerId: number
  ownerName: string
  ownerPhone: string | null
  groomerId: number
  groomerName: string
  /** Sisa tagihan NOTA; 0 = lunas. */
  debtRemaining: number
  isPaid: boolean
  changes: GroomerChangeView[]
}

export interface DeliveryHistoryRow {
  id: number
  trxNumber: string
  transactionId: number
  branchId: number
  branchName: string
  status: string
  createdAt: Date
  courierId: number
  courierName: string
  /** GROOMING = antar-jemput kucing (ada alamat); BARANG = antar barang dari tab Kasir. */
  kind: 'GROOMING' | 'BARANG'
  /** Kosong untuk antar barang tanpa pelanggan. */
  ownerName: string | null
  address: string | null
  /** Ongkir di nota. */
  fee: number
  netFee: number
  /** Bonus pengantar; 0 bila delivery dibatalkan. */
  bonus: number
  isPaid: boolean
}

export interface GroomingReportFilters {
  /** Batas cabang dari hak akses (scopeFilter) — undefined = semua cabang. */
  branchScope?: SQL
  branchId?: number
  /** Berdasarkan waktu kucing diterima (= tanggal nota). `to` eksklusif. */
  from: Date
  to: Date
  groomerId?: number
  q?: string
  payment?: 'LUNAS' | 'BELUM'
  limit?: number
}

const debtRemainingOf = (transactionId: unknown) => sql<number>`COALESCE((
  SELECT SUM(cd.remaining_amount) FROM petshop.customer_debts cd
  WHERE cd.transaction_id = ${transactionId} AND cd.status <> 'VOIDED'
), 0)::integer`

const linesTotalOf = (transactionId: unknown) => sql<number>`COALESCE((
  SELECT SUM(ti.total_price) FROM petshop.transaction_items ti WHERE ti.transaction_id = ${transactionId}
), 0)::integer`

export async function listGroomingHistory(filters: GroomingReportFilters): Promise<GroomingHistoryRow[]> {
  const q = filters.q?.trim()
  const digits = phoneSearchDigits(q)
  const phoneNormalized = sql<string>`regexp_replace(regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g'), '^62', '0')`
  const debtRemaining = debtRemainingOf(groomingOrders.transactionId)

  const rows = await db
    .select({
      id: groomingOrders.id,
      sequence: groomingOrders.sequence,
      trxNumber: transactions.trxNumber,
      transactionId: groomingOrders.transactionId,
      branchId: groomingOrders.branchId,
      branchName: branches.name,
      status: groomingOrders.status,
      receivedAt: groomingOrders.receivedAt,
      pickedUpAt: groomingOrders.pickedUpAt,
      cancelledAt: groomingOrders.cancelledAt,
      cancelReason: groomingOrders.cancelReason,
      condition: groomingOrders.condition,
      serviceName: transactionItems.productName,
      price: transactionItems.totalPrice,
      payableAmount: transactions.payableAmount,
      linesTotal: linesTotalOf(groomingOrders.transactionId),
      petName: pets.name,
      petSpecies: pets.species,
      ownerId: customers.id,
      ownerName: customers.name,
      ownerPhone: customers.phone,
      groomerId: groomers.id,
      groomerName: groomers.name,
      debtRemaining,
    })
    .from(groomingOrders)
    .innerJoin(transactions, eq(transactions.id, groomingOrders.transactionId))
    .innerJoin(transactionItems, eq(transactionItems.id, groomingOrders.transactionItemId))
    .innerJoin(branches, eq(branches.id, groomingOrders.branchId))
    .innerJoin(pets, eq(pets.id, groomingOrders.petId))
    .innerJoin(customers, eq(customers.id, groomingOrders.customerId))
    .innerJoin(groomers, eq(groomers.id, groomingOrders.groomerId))
    .where(and(
      filters.branchScope,
      filters.branchId ? eq(groomingOrders.branchId, filters.branchId) : undefined,
      gte(groomingOrders.receivedAt, filters.from),
      lt(groomingOrders.receivedAt, filters.to),
      filters.groomerId ? eq(groomingOrders.groomerId, filters.groomerId) : undefined,
      filters.payment === 'LUNAS' ? sql`${debtRemaining} <= 0` : undefined,
      filters.payment === 'BELUM' ? sql`${debtRemaining} > 0` : undefined,
      q
        ? or(
            ilike(pets.name, `%${q}%`),
            ilike(customers.name, `%${q}%`),
            ilike(transactions.trxNumber, `%${q}%`),
            digits.length >= 3 ? sql`${phoneNormalized} LIKE ${`%${digits}%`}` : undefined,
          )
        : undefined,
    ))
    .orderBy(desc(groomingOrders.receivedAt), asc(groomingOrders.id))
    .limit(Math.min(filters.limit ?? 2000, 5000))

  const changesByOrder = await loadGroomerChanges(rows.map((r) => r.id))

  return rows.map((r) => {
    const cancelled = r.status === GROOMING_STATUS.DIBATALKAN
    const netPrice = netLineAmount(r.price, r.payableAmount, Number(r.linesTotal ?? 0))
    const remaining = Number(r.debtRemaining ?? 0)
    return {
      id: r.id,
      ticketNumber: `${r.trxNumber}/${r.sequence}`,
      trxNumber: r.trxNumber,
      transactionId: r.transactionId,
      branchId: r.branchId,
      branchName: r.branchName,
      status: r.status,
      receivedAt: r.receivedAt,
      pickedUpAt: r.pickedUpAt,
      cancelledAt: r.cancelledAt,
      cancelReason: r.cancelReason,
      condition: r.condition,
      serviceName: r.serviceName ?? 'Jasa grooming',
      price: r.price,
      netPrice,
      bonus: cancelled ? 0 : bonusOf(netPrice, GROOMER_BONUS_PERCENT),
      petName: r.petName,
      petSpecies: r.petSpecies,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      ownerPhone: r.ownerPhone,
      groomerId: r.groomerId,
      groomerName: r.groomerName,
      debtRemaining: remaining,
      isPaid: remaining <= 0,
      changes: changesByOrder.get(r.id) ?? [],
    }
  })
}

async function loadGroomerChanges(orderIds: number[]): Promise<Map<number, GroomerChangeView[]>> {
  const map = new Map<number, GroomerChangeView[]>()
  if (orderIds.length === 0) return map
  const oldGroomer = alias(groomers, 'old_groomer')
  const newGroomer = alias(groomers, 'new_groomer')
  const rows = await db
    .select({
      orderId: groomingGroomerChanges.groomingOrderId,
      at: groomingGroomerChanges.createdAt,
      by: users.name,
      from: oldGroomer.name,
      to: newGroomer.name,
      reason: groomingGroomerChanges.reason,
    })
    .from(groomingGroomerChanges)
    .innerJoin(oldGroomer, eq(oldGroomer.id, groomingGroomerChanges.oldGroomerId))
    .innerJoin(newGroomer, eq(newGroomer.id, groomingGroomerChanges.newGroomerId))
    .leftJoin(users, eq(users.id, groomingGroomerChanges.changedById))
    .where(inArray(groomingGroomerChanges.groomingOrderId, orderIds))
    .orderBy(asc(groomingGroomerChanges.createdAt), asc(groomingGroomerChanges.id))
  for (const r of rows) {
    const list = map.get(r.orderId) ?? []
    list.push({ at: r.at, by: r.by, from: r.from, to: r.to, reason: r.reason })
    map.set(r.orderId, list)
  }
  return map
}

/** Delivery (antar-jemput) pada periode yang sama — dasar bonus pengantar. Saringan groomer/cari tidak berlaku. */
export async function listDeliveryHistory(filters: Pick<GroomingReportFilters, 'branchScope' | 'branchId' | 'from' | 'to'>): Promise<DeliveryHistoryRow[]> {
  const rows = await db
    .select({
      id: serviceDeliveries.id,
      trxNumber: transactions.trxNumber,
      transactionId: serviceDeliveries.transactionId,
      branchId: serviceDeliveries.branchId,
      branchName: branches.name,
      status: serviceDeliveries.status,
      createdAt: serviceDeliveries.createdAt,
      courierId: groomers.id,
      courierName: groomers.name,
      ownerName: customers.name,
      address: serviceDeliveries.address,
      fee: transactionItems.totalPrice,
      payableAmount: transactions.payableAmount,
      linesTotal: linesTotalOf(serviceDeliveries.transactionId),
      debtRemaining: debtRemainingOf(serviceDeliveries.transactionId),
    })
    .from(serviceDeliveries)
    .innerJoin(transactions, eq(transactions.id, serviceDeliveries.transactionId))
    .innerJoin(transactionItems, eq(transactionItems.id, serviceDeliveries.transactionItemId))
    .innerJoin(branches, eq(branches.id, serviceDeliveries.branchId))
    .leftJoin(customers, eq(customers.id, serviceDeliveries.customerId))
    .innerJoin(groomers, eq(groomers.id, serviceDeliveries.courierId))
    .where(and(
      filters.branchScope,
      filters.branchId ? eq(serviceDeliveries.branchId, filters.branchId) : undefined,
      gte(serviceDeliveries.createdAt, filters.from),
      lt(serviceDeliveries.createdAt, filters.to),
    ))
    .orderBy(desc(serviceDeliveries.createdAt), asc(serviceDeliveries.id))
    .limit(5000)

  return rows.map((r) => {
    const cancelled = r.status === DELIVERY_STATUS.DIBATALKAN
    const netFee = netLineAmount(r.fee, r.payableAmount, Number(r.linesTotal ?? 0))
    return {
      id: r.id,
      trxNumber: r.trxNumber,
      transactionId: r.transactionId,
      branchId: r.branchId,
      branchName: r.branchName,
      status: r.status,
      createdAt: r.createdAt,
      courierId: r.courierId,
      courierName: r.courierName,
      kind: r.address == null ? 'BARANG' : 'GROOMING',
      ownerName: r.ownerName,
      address: r.address,
      fee: r.fee,
      netFee,
      bonus: cancelled ? 0 : bonusOf(netFee, COURIER_BONUS_PERCENT),
      isPaid: Number(r.debtRemaining ?? 0) <= 0,
    }
  })
}

export interface BonusGroup {
  key: string
  label: string
  /** Jumlah grooming / delivery yang dihitung (yang dibatalkan tidak ikut). */
  count: number
  /** Nilai sesudah diskon. */
  netTotal: number
  bonus: number
  /** Di antaranya: yang notanya belum lunas. */
  unpaidCount: number
  unpaidBonus: number
}

export interface GroomingSummary {
  byGroomer: BonusGroup[]
  byService: BonusGroup[]
  byBranch: BonusGroup[]
  byCourier: BonusGroup[]
  grooming: { count: number; netTotal: number; bonus: number; cancelledCount: number; unpaidCount: number }
  delivery: { count: number; netTotal: number; bonus: number; cancelledCount: number }
}

function addTo(map: Map<string, BonusGroup>, key: string, label: string, net: number, bonus: number, paid: boolean) {
  const g = map.get(key) ?? { key, label, count: 0, netTotal: 0, bonus: 0, unpaidCount: 0, unpaidBonus: 0 }
  g.count += 1
  g.netTotal += net
  g.bonus += bonus
  if (!paid) {
    g.unpaidCount += 1
    g.unpaidBonus += bonus
  }
  map.set(key, g)
}

const sorted = (map: Map<string, BonusGroup>) => [...map.values()].sort((a, b) => b.bonus - a.bonus || a.label.localeCompare(b.label))

/** Ringkasan bonus dari baris riwayat. Yang dibatalkan (nota batal / baris diretur) tidak dihitung. */
export function summarizeGrooming(rows: GroomingHistoryRow[], deliveries: DeliveryHistoryRow[]): GroomingSummary {
  const byGroomer = new Map<string, BonusGroup>()
  const byService = new Map<string, BonusGroup>()
  const byBranch = new Map<string, BonusGroup>()
  const byCourier = new Map<string, BonusGroup>()
  const grooming = { count: 0, netTotal: 0, bonus: 0, cancelledCount: 0, unpaidCount: 0 }
  const delivery = { count: 0, netTotal: 0, bonus: 0, cancelledCount: 0 }

  for (const r of rows) {
    if (r.status === GROOMING_STATUS.DIBATALKAN) {
      grooming.cancelledCount += 1
      continue
    }
    grooming.count += 1
    grooming.netTotal += r.netPrice
    grooming.bonus += r.bonus
    if (!r.isPaid) grooming.unpaidCount += 1
    addTo(byGroomer, String(r.groomerId), r.groomerName, r.netPrice, r.bonus, r.isPaid)
    addTo(byService, r.serviceName, r.serviceName, r.netPrice, r.bonus, r.isPaid)
    addTo(byBranch, String(r.branchId), r.branchName, r.netPrice, r.bonus, r.isPaid)
  }
  for (const d of deliveries) {
    if (d.status === DELIVERY_STATUS.DIBATALKAN) {
      delivery.cancelledCount += 1
      continue
    }
    delivery.count += 1
    delivery.netTotal += d.netFee
    delivery.bonus += d.bonus
    addTo(byCourier, String(d.courierId), d.courierName, d.netFee, d.bonus, d.isPaid)
  }
  return { byGroomer: sorted(byGroomer), byService: sorted(byService), byBranch: sorted(byBranch), byCourier: sorted(byCourier), grooming, delivery }
}

interface ChangeActor {
  userId: number
  branchId: number
  /** OWNER/GM boleh lintas cabang; selain itu hanya cabangnya sendiri. */
  allBranches: boolean
}

/**
 * Ganti Groomer — satu-satunya perubahan yang boleh pada catatan grooming yang sudah tersimpan
 * (keputusan owner: salah pilih groomer diperbaiki Owner di Back Office). Alasan wajib; groomer
 * lama → baru tercatat di `grooming_groomer_changes` + audit. Bonus mengikuti groomer baru.
 * Grooming yang sudah dibatalkan tidak bisa diubah.
 */
export async function changeGroomer(
  orderId: number,
  input: { groomerId: number; reason: string },
  actor: ChangeActor,
): Promise<{ id: number; oldGroomerId: number; newGroomerId: number }> {
  const reason = input.reason.trim()
  if (reason.length < GROOMER_CHANGE_REASON_MIN) {
    throw new GroomingOrderError('REASON_REQUIRED', `Alasan ganti groomer wajib diisi (minimal ${GROOMER_CHANGE_REASON_MIN} huruf)`)
  }
  if (reason.length > GROOMER_CHANGE_REASON_MAX) {
    throw new GroomingOrderError('REASON_REQUIRED', `Alasan maksimal ${GROOMER_CHANGE_REASON_MAX} huruf`)
  }

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select({ id: groomingOrders.id, status: groomingOrders.status, groomerId: groomingOrders.groomerId, branchId: groomingOrders.branchId })
      .from(groomingOrders)
      .where(and(eq(groomingOrders.id, orderId), actor.allBranches ? undefined : eq(groomingOrders.branchId, actor.branchId)))
      .for('update')
      .limit(1)
    if (!order) throw new GroomingOrderError('NOT_FOUND', 'Data grooming tidak ditemukan', 404)
    if (order.status === GROOMING_STATUS.DIBATALKAN) {
      throw new GroomingOrderError('WRONG_STATUS', 'Grooming ini sudah dibatalkan, groomernya tidak bisa diganti', 409)
    }
    if (order.groomerId === input.groomerId) {
      throw new GroomingOrderError('SAME_GROOMER', 'Groomer yang dipilih sama dengan groomer sekarang')
    }
    const [groomer] = await tx
      .select({ id: groomers.id, name: groomers.name, isActive: groomers.isActive, isGroomer: groomers.isGroomer })
      .from(groomers).where(eq(groomers.id, input.groomerId)).limit(1)
    if (!groomer) throw new GroomingOrderError('GROOMER_NOT_FOUND', 'Groomer tidak ditemukan')
    if (!groomer.isActive) throw new GroomingOrderError('GROOMER_INACTIVE', `Groomer ${groomer.name} sudah dinonaktifkan`)
    if (!groomer.isGroomer) throw new GroomingOrderError('GROOMER_ROLE', `${groomer.name} terdaftar sebagai pengantar, bukan groomer`)

    await tx.insert(groomingGroomerChanges).values({
      groomingOrderId: order.id, oldGroomerId: order.groomerId, newGroomerId: groomer.id, reason, changedById: actor.userId,
    })
    await tx.update(groomingOrders).set({ groomerId: groomer.id }).where(eq(groomingOrders.id, order.id))
    await tx.insert(auditLogs).values({
      branchId: order.branchId, userId: actor.userId, action: 'GROOMING_GROOMER_CHANGE', tableName: 'grooming_orders',
      recordId: String(order.id), oldData: JSON.stringify({ groomerId: order.groomerId }),
      newData: JSON.stringify({ groomerId: groomer.id, reason }),
    })
    return { id: order.id, oldGroomerId: order.groomerId, newGroomerId: groomer.id }
  })
}
