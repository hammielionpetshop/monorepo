import { randomUUID } from 'node:crypto'
import { alias } from 'drizzle-orm/pg-core'
import {
  db, recurringCosts, recurringCostAmounts, recurringCostPayments, cashFlowCategories, cashFlowEntries, moneyPlaces, branches, users,
  eq, and, asc, desc, gte, isNull, inArray, sql,
} from '@/lib/db'
import { todayWibDate } from '@/lib/payment-date'
import { checkCancel, checkOccurredOn, monthStart } from './cash-flow-rules'
import {
  addMonths, amountFor, billMonths, billStatus, checkAmountChange, checkCostChange, checkPay, dueDateFor, isMonth, monthsBetween,
  splitPaid, PREPAY_MONTHS, type AmountStep, type BillStatus,
} from './recurring-cost-rules'

/**
 * F2-5a Biaya Rutin (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §2).
 * Tagihan dihitung dari pengaturan; "Sudah dibayar" menulis satu pembayaran + satu catatan Arus Kas per bulan
 * dalam satu transaksi DB. Batal = isi pembatalan di keduanya (tidak ada yang dihapus).
 */

export class RecurringCostError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface CostActor {
  userId: number
  isOwner: boolean
  canCancelAny: boolean
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const month = (date: string) => date.slice(0, 7)
const currentMonth = () => todayWibDate().slice(0, 7)
const paymentCreatedOn = sql<string>`to_char(${recurringCostPayments.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`

export interface CostInput {
  name: string
  categoryId: number
  branchId: number | null
  dueDay: number
  startMonth: string
  endMonth: string | null
  note: string | null
}

async function checkCategoryAndBranch(tx: Tx, categoryId: number, branchId: number | null) {
  const [category] = await tx
    .select({ type: cashFlowCategories.type, reportKind: cashFlowCategories.reportKind, isActive: cashFlowCategories.isActive })
    .from(cashFlowCategories)
    .where(eq(cashFlowCategories.id, categoryId))
    .limit(1)
  if (!category) throw new RecurringCostError('Kategori tidak ditemukan', 400)
  if (category.type !== 'EXPENSE' || category.reportKind !== 'COST') throw new RecurringCostError('Kategori Biaya Rutin harus berjenis Biaya', 400)
  if (!category.isActive) throw new RecurringCostError('Kategori sudah nonaktif', 400)
  if (branchId !== null) {
    const [branch] = await tx.select({ id: branches.id }).from(branches).where(eq(branches.id, branchId)).limit(1)
    if (!branch) throw new RecurringCostError('Cabang tidak ditemukan', 400)
  }
}

function checkBasics(input: CostInput) {
  if (!input.name.trim()) throw new RecurringCostError('Nama wajib diisi', 400)
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) throw new RecurringCostError('Tanggal jatuh tempo 1–31', 400)
  if (!isMonth(input.startMonth)) throw new RecurringCostError('Berlaku mulai tidak valid', 400)
  if (input.endMonth !== null && !isMonth(input.endMonth)) throw new RecurringCostError('Berlaku sampai tidak valid', 400)
  if (input.endMonth && input.endMonth < input.startMonth) throw new RecurringCostError('Berlaku sampai tidak boleh sebelum Berlaku mulai', 400)
}

export async function createRecurringCost(input: CostInput & { amount: number }, actor: CostActor) {
  checkBasics(input)
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new RecurringCostError('Jumlah per bulan harus lebih dari 0', 400)
  return db.transaction(async (tx) => {
    await checkCategoryAndBranch(tx, input.categoryId, input.branchId)
    const [cost] = await tx
      .insert(recurringCosts)
      .values({
        name: input.name.trim(),
        categoryId: input.categoryId,
        branchId: input.branchId,
        dueDay: input.dueDay,
        startMonth: monthStart(input.startMonth),
        endMonth: input.endMonth ? monthStart(input.endMonth) : null,
        note: input.note,
        createdBy: actor.userId,
      })
      .returning()
    await tx.insert(recurringCostAmounts).values({
      recurringCostId: cost.id, amount: input.amount, effectiveMonth: monthStart(input.startMonth), createdBy: actor.userId,
    })
    return cost
  })
}

async function paidMonthsOf(tx: Tx, costId: number): Promise<string[]> {
  const rows = await tx
    .select({ forMonth: recurringCostPayments.forMonth })
    .from(recurringCostPayments)
    .where(and(eq(recurringCostPayments.recurringCostId, costId), isNull(recurringCostPayments.cancelledAt)))
    .orderBy(asc(recurringCostPayments.forMonth))
  return rows.map((r) => month(r.forMonth))
}

async function lockCost(tx: Tx, id: number) {
  const [cost] = await tx.select().from(recurringCosts).where(eq(recurringCosts.id, id)).for('update').limit(1)
  if (!cost) throw new RecurringCostError('Biaya Rutin tidak ditemukan', 404)
  return cost
}

export async function updateRecurringCost(id: number, input: CostInput & { isActive: boolean }, actor: CostActor) {
  checkBasics(input)
  return db.transaction(async (tx) => {
    const cost = await lockCost(tx, id)
    const paid = await paidMonthsOf(tx, id)
    const error = checkCostChange({
      hasPayments: paid.length > 0,
      lastPaidMonth: paid.at(-1) ?? null,
      current: { categoryId: cost.categoryId, branchId: cost.branchId, startMonth: month(cost.startMonth) },
      next: { categoryId: input.categoryId, branchId: input.branchId, startMonth: input.startMonth, endMonth: input.endMonth, isActive: input.isActive, wasActive: cost.isActive },
    })
    if (error) throw new RecurringCostError(error, 409)
    if (input.categoryId !== cost.categoryId || input.branchId !== cost.branchId) await checkCategoryAndBranch(tx, input.categoryId, input.branchId)

    if (input.startMonth !== month(cost.startMonth)) {
      // Belum ada pembayaran: langkah jumlah sebelum bulan mulai baru digeser ke bulan mulai itu.
      const steps = await tx.select().from(recurringCostAmounts).where(eq(recurringCostAmounts.recurringCostId, id))
      const startAmount = amountFor(steps.map((s) => ({ effectiveMonth: month(s.effectiveMonth), amount: s.amount })), input.startMonth)
        ?? [...steps].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))[0]?.amount
      if (startAmount && !steps.some((s) => month(s.effectiveMonth) === input.startMonth)) {
        await tx.insert(recurringCostAmounts).values({
          recurringCostId: id, amount: startAmount, effectiveMonth: monthStart(input.startMonth), createdBy: actor.userId,
        })
      }
    }

    const [updated] = await tx
      .update(recurringCosts)
      .set({
        name: input.name.trim(),
        categoryId: input.categoryId,
        branchId: input.branchId,
        dueDay: input.dueDay,
        startMonth: monthStart(input.startMonth),
        endMonth: input.endMonth ? monthStart(input.endMonth) : null,
        note: input.note,
        isActive: input.isActive,
        updatedBy: actor.userId,
        updatedAt: sql`now()`,
      })
      .where(eq(recurringCosts.id, id))
      .returning()
    return updated
  })
}

/** Jumlah baru mulai bulan X; bulan yang sama ditimpa (pengaturan, bukan catatan uang). */
export async function changeRecurringCostAmount(id: number, input: { effectiveMonth: string; amount: number }, actor: CostActor) {
  return db.transaction(async (tx) => {
    const cost = await lockCost(tx, id)
    const paid = await paidMonthsOf(tx, id)
    const error = checkAmountChange({
      effectiveMonth: input.effectiveMonth, startMonth: month(cost.startMonth), lastPaidMonth: paid.at(-1) ?? null, amount: input.amount,
    })
    if (error) throw new RecurringCostError(error, 409)
    await tx
      .insert(recurringCostAmounts)
      .values({ recurringCostId: id, amount: input.amount, effectiveMonth: monthStart(input.effectiveMonth), createdBy: actor.userId })
      .onConflictDoUpdate({
        target: [recurringCostAmounts.recurringCostId, recurringCostAmounts.effectiveMonth],
        set: { amount: input.amount, createdBy: actor.userId, createdAt: sql`now()` },
      })
  })
}

export interface PayInput {
  recurringCostId: number
  fromMonth: string
  toMonth: string
  occurredOn: string
  moneyPlaceId: number
  amount: number
  differenceReason: string | null
  proofPhotoUrl: string | null
}

export async function payRecurringCost(input: PayInput, actor: CostActor) {
  const today = todayWibDate()
  const dateError = checkOccurredOn(input.occurredOn, today, actor.isOwner)
  if (dateError) throw new RecurringCostError(dateError, 400)
  return db.transaction(async (tx) => {
    const cost = await lockCost(tx, input.recurringCostId)
    const [place] = await tx
      .select({ kind: moneyPlaces.kind, isActive: moneyPlaces.isActive })
      .from(moneyPlaces)
      .where(eq(moneyPlaces.id, input.moneyPlaceId))
      .limit(1)
    if (!place) throw new RecurringCostError('Pilih "Dibayar dari" (Tempat Uang)', 400)
    if (place.kind === 'DRAWER') throw new RecurringCostError('Laci kasir tidak bisa dipakai untuk Biaya Rutin', 400)
    if (!place.isActive) throw new RecurringCostError('Tempat Uang sudah nonaktif', 400)

    const steps = await amountSteps(tx, [cost.id])
    const months = isMonth(input.fromMonth) && isMonth(input.toMonth) ? monthsBetween(input.fromMonth, input.toMonth) : []
    const billed = months.map((m) => ({ month: m, amount: amountFor(steps.get(cost.id) ?? [], m) }))
    const reason = input.differenceReason?.trim() || null
    const error = checkPay({
      schedule: { startMonth: month(cost.startMonth), endMonth: cost.endMonth ? month(cost.endMonth) : null, isActive: cost.isActive },
      fromMonth: input.fromMonth,
      toMonth: input.toMonth,
      paidMonths: new Set(await paidMonthsOf(tx, cost.id)),
      currentMonth: today.slice(0, 7),
      billed,
      amount: input.amount,
      differenceReason: reason,
    })
    if (error) throw new RecurringCostError(error, 409)

    const parts = splitPaid(billed.map((b) => b.amount!), input.amount)
    const batchKey = randomUUID()
    const label = months.length > 1 ? ` (${months[0]} s.d. ${months.at(-1)})` : ''
    const note = `Biaya Rutin: ${cost.name}${label}${reason ? ` — ${reason}` : ''}`.slice(0, 255)
    for (let i = 0; i < months.length; i++) {
      const [entry] = await tx
        .insert(cashFlowEntries)
        .values({
          type: 'EXPENSE',
          categoryId: cost.categoryId,
          branchId: cost.branchId,
          amount: parts[i],
          note,
          occurredOn: input.occurredOn,
          forMonth: monthStart(months[i]),
          moneyPlaceId: input.moneyPlaceId,
          proofPhotoUrl: input.proofPhotoUrl,
          createdBy: actor.userId,
        })
        .returning({ id: cashFlowEntries.id })
      await tx.insert(recurringCostPayments).values({
        recurringCostId: cost.id,
        forMonth: monthStart(months[i]),
        billedAmount: billed[i].amount!,
        amount: parts[i],
        differenceReason: reason,
        cashFlowEntryId: entry.id,
        batchKey,
        createdBy: actor.userId,
      })
    }
    return { batchKey, months }
  })
}

export async function cancelRecurringCostPayment(batchKey: string, reason: string, actor: CostActor): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new RecurringCostError('Alasan pembatalan wajib diisi (minimal 3 huruf)', 400)
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: recurringCostPayments.id,
        cashFlowEntryId: recurringCostPayments.cashFlowEntryId,
        createdBy: recurringCostPayments.createdBy,
        createdOn: paymentCreatedOn,
        cancelledAt: recurringCostPayments.cancelledAt,
      })
      .from(recurringCostPayments)
      .where(eq(recurringCostPayments.batchKey, batchKey))
      .for('update')
    if (rows.length === 0) throw new RecurringCostError('Pembayaran tidak ditemukan', 404)
    const error = checkCancel({
      isCancelled: rows.every((r) => r.cancelledAt !== null),
      isSystemCategory: false,
      createdBy: rows[0].createdBy,
      createdOn: rows[0].createdOn,
      actorId: actor.userId,
      actorCanCancelAny: actor.canCancelAny,
      today: todayWibDate(),
    })
    if (error) throw new RecurringCostError(error.replace('Catatan', 'Pembayaran'), 409)

    const open = rows.filter((r) => r.cancelledAt === null)
    await tx
      .update(recurringCostPayments)
      .set({ cancelledAt: sql`now()`, cancelledBy: actor.userId, cancelReason: trimmed })
      .where(inArray(recurringCostPayments.id, open.map((r) => r.id)))
    await tx
      .update(cashFlowEntries)
      .set({ cancelledAt: sql`now()`, cancelledBy: actor.userId, cancelReason: `Pembayaran Biaya Rutin dibatalkan: ${trimmed}` })
      .where(and(inArray(cashFlowEntries.id, open.map((r) => r.cashFlowEntryId)), isNull(cashFlowEntries.cancelledAt)))
  })
}

async function amountSteps(tx: Tx | typeof db, ids: number[]): Promise<Map<number, AmountStep[]>> {
  const map = new Map<number, AmountStep[]>()
  if (ids.length === 0) return map
  const rows = await tx.select().from(recurringCostAmounts).where(inArray(recurringCostAmounts.recurringCostId, ids))
  for (const r of rows) {
    const list = map.get(r.recurringCostId) ?? []
    list.push({ effectiveMonth: month(r.effectiveMonth), amount: r.amount })
    map.set(r.recurringCostId, list)
  }
  return map
}

export interface CostRow {
  id: number
  name: string
  categoryId: number
  categoryName: string
  branchId: number | null
  branchName: string | null
  dueDay: number
  startMonth: string
  endMonth: string | null
  note: string | null
  isActive: boolean
  currentAmount: number | null
  amounts: AmountStep[]
  lastPaidMonth: string | null
}

export interface BillPayment {
  batchKey: string
  amount: number
  differenceReason: string | null
  occurredOn: string
  moneyPlaceName: string | null
  proofPhotoUrl: string | null
  createdByName: string | null
  batchMonths: string[]
  canCancel: boolean
}

export interface BillRow {
  costId: number
  name: string
  categoryName: string
  branchId: number | null
  branchName: string | null
  month: string
  amount: number | null
  dueDate: string
  status: BillStatus
  payment: BillPayment | null
}

export async function listRecurringCosts(actor: CostActor): Promise<{ costs: CostRow[]; bills: BillRow[] }> {
  const today = todayWibDate()
  const nowMonth = today.slice(0, 7)
  const costs = await db
    .select({
      id: recurringCosts.id,
      name: recurringCosts.name,
      categoryId: recurringCosts.categoryId,
      categoryName: cashFlowCategories.name,
      branchId: recurringCosts.branchId,
      branchName: branches.name,
      dueDay: recurringCosts.dueDay,
      startMonth: recurringCosts.startMonth,
      endMonth: recurringCosts.endMonth,
      note: recurringCosts.note,
      isActive: recurringCosts.isActive,
    })
    .from(recurringCosts)
    .innerJoin(cashFlowCategories, eq(cashFlowCategories.id, recurringCosts.categoryId))
    .leftJoin(branches, eq(branches.id, recurringCosts.branchId))
    .orderBy(desc(recurringCosts.isActive), asc(recurringCosts.name))

  const ids = costs.map((c) => c.id)
  const steps = await amountSteps(db, ids)
  const payments = ids.length
    ? await db
        .select({
          costId: recurringCostPayments.recurringCostId,
          forMonth: recurringCostPayments.forMonth,
          amount: recurringCostPayments.amount,
          differenceReason: recurringCostPayments.differenceReason,
          batchKey: recurringCostPayments.batchKey,
          createdBy: recurringCostPayments.createdBy,
          createdOn: paymentCreatedOn,
          occurredOn: cashFlowEntries.occurredOn,
          moneyPlaceName: moneyPlaces.name,
          proofPhotoUrl: cashFlowEntries.proofPhotoUrl,
          createdByName: users.name,
        })
        .from(recurringCostPayments)
        .innerJoin(cashFlowEntries, eq(cashFlowEntries.id, recurringCostPayments.cashFlowEntryId))
        .leftJoin(moneyPlaces, eq(moneyPlaces.id, cashFlowEntries.moneyPlaceId))
        .leftJoin(users, eq(users.id, recurringCostPayments.createdBy))
        .where(and(inArray(recurringCostPayments.recurringCostId, ids), isNull(recurringCostPayments.cancelledAt)))
    : []

  const batchMonths = new Map<string, string[]>()
  for (const p of payments) batchMonths.set(p.batchKey, [...(batchMonths.get(p.batchKey) ?? []), month(p.forMonth)].sort())
  const paidBy = new Map(payments.map((p) => [`${p.costId}|${month(p.forMonth)}`, p]))

  const bills: BillRow[] = []
  const rows: CostRow[] = costs.map((c) => {
    const costSteps = (steps.get(c.id) ?? []).sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))
    const schedule = { startMonth: month(c.startMonth), endMonth: c.endMonth ? month(c.endMonth) : null, isActive: c.isActive }
    const paidMonths = payments.filter((p) => p.costId === c.id).map((p) => month(p.forMonth)).sort()
    // Bulan berjalan dan sebelumnya selalu tampil; bulan depan hanya bila sudah dibayar di muka.
    const months = new Set([...billMonths(schedule, nowMonth), ...paidMonths])
    for (const m of [...months].sort()) {
      const p = paidBy.get(`${c.id}|${m}`)
      const dueDate = dueDateFor(m, c.dueDay)
      bills.push({
        costId: c.id,
        name: c.name,
        categoryName: c.categoryName,
        branchId: c.branchId,
        branchName: c.branchName,
        month: m,
        amount: amountFor(costSteps, m),
        dueDate,
        status: billStatus(dueDate, today, !!p),
        payment: p
          ? {
              batchKey: p.batchKey,
              amount: p.amount,
              differenceReason: p.differenceReason,
              occurredOn: p.occurredOn,
              moneyPlaceName: p.moneyPlaceName,
              proofPhotoUrl: p.proofPhotoUrl,
              createdByName: p.createdByName,
              batchMonths: batchMonths.get(p.batchKey) ?? [m],
              canCancel: checkCancel({
                isCancelled: false, isSystemCategory: false, createdBy: p.createdBy, createdOn: p.createdOn,
                actorId: actor.userId, actorCanCancelAny: actor.canCancelAny, today,
              }) === null,
            }
          : null,
      })
    }
    return {
      ...c,
      startMonth: schedule.startMonth,
      endMonth: schedule.endMonth,
      currentAmount: amountFor(costSteps, nowMonth < schedule.startMonth ? schedule.startMonth : nowMonth),
      amounts: costSteps,
      lastPaidMonth: paidMonths.at(-1) ?? null,
    }
  })
  bills.sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name))
  return { costs: rows, bills }
}

/** Catatan "Sewa (sementara)" 3 bulan terakhir — pengingat agar sewa yang sudah dibayar tidak tertagih dua kali. */
export async function recentTemporaryRent() {
  const since = monthStart(addMonths(currentMonth(), -3))
  const placeAlias = alias(moneyPlaces, 'place')
  return db
    .select({
      id: cashFlowEntries.id,
      branchId: cashFlowEntries.branchId,
      branchName: branches.name,
      amount: cashFlowEntries.amount,
      forMonth: cashFlowEntries.forMonth,
      occurredOn: cashFlowEntries.occurredOn,
      note: cashFlowEntries.note,
      moneyPlaceName: placeAlias.name,
    })
    .from(cashFlowEntries)
    .innerJoin(cashFlowCategories, eq(cashFlowCategories.id, cashFlowEntries.categoryId))
    .leftJoin(branches, eq(branches.id, cashFlowEntries.branchId))
    .leftJoin(placeAlias, eq(placeAlias.id, cashFlowEntries.moneyPlaceId))
    .where(and(
      eq(cashFlowCategories.name, 'Sewa (sementara)'),
      eq(cashFlowCategories.type, 'EXPENSE'),
      isNull(cashFlowEntries.cancelledAt),
      gte(cashFlowEntries.forMonth, since),
    ))
    .orderBy(desc(cashFlowEntries.forMonth))
}

/** Batas bulan untuk form Bayar (bayar di muka). */
export function prepayLimit(): string {
  return addMonths(currentMonth(), PREPAY_MONTHS)
}
