import {
  db,
  shiftExpenses,
  shifts,
  users,
  branches,
  expenseCategories,
  auditLogs,
  eq,
  and,
  desc,
  gte,
  lte,
  ilike,
  or,
} from '@/lib/db'
import type { SQL } from 'drizzle-orm'

/** Batas `integer` PostgreSQL — nominal di atas ini membuat insert gagal dengan error mentah. */
export const MAX_AMOUNT = 2147483647

/** Kode kegagalan yang dipetakan ke status HTTP oleh route pemanggil. */
export type ShiftExpenseError =
  | 'NOT_FOUND'
  | 'SHIFT_CLOSED'
  | 'OUT_OF_SCOPE'

export class ShiftExpenseServiceError extends Error {
  constructor(public readonly code: ShiftExpenseError) {
    super(code)
    this.name = 'ShiftExpenseServiceError'
  }
}

export interface ShiftExpenseRow {
  id: number
  shiftId: number
  shiftNumber: number
  shiftStatus: string
  branchId: number
  branchName: string | null
  cashierId: number
  cashierName: string | null
  categoryId: number | null
  categoryName: string | null
  categoryCustom: string | null
  amount: number
  note: string
  proofImage: string | null
  createdAt: Date
}

export interface ListFilters {
  branchId?: number
  cashierId?: number
  shiftId?: number
  categoryId?: number
  /** Hanya pengeluaran di shift yang masih berjalan — yang masih boleh diubah. */
  onlyOpenShift?: boolean
  startDate?: string
  endDate?: string
  /** Cari di catatan maupun kategori bebas. */
  q?: string
  limit?: number
}

/**
 * Daftar pengeluaran shift. `scope` adalah kondisi cabang dari `scopeFilter()`; kalau
 * `undefined` berarti user boleh melihat semua cabang.
 */
export async function listShiftExpenses(
  filters: ListFilters,
  scope?: SQL | undefined,
): Promise<ShiftExpenseRow[]> {
  const conditions: (SQL | undefined)[] = [scope]

  if (filters.branchId) conditions.push(eq(shifts.branchId, filters.branchId))
  if (filters.cashierId) conditions.push(eq(shiftExpenses.cashierId, filters.cashierId))
  if (filters.shiftId) conditions.push(eq(shiftExpenses.shiftId, filters.shiftId))
  if (filters.categoryId) conditions.push(eq(shiftExpenses.categoryId, filters.categoryId))
  if (filters.onlyOpenShift) conditions.push(eq(shifts.status, 'OPEN'))
  // Batas hari dihitung di WIB, bukan UTC: pengeluaran jam 23:30 WIB milik hari itu,
  // bukan hari berikutnya.
  if (filters.startDate) {
    conditions.push(gte(shiftExpenses.createdAt, new Date(filters.startDate + 'T00:00:00.000+07:00')))
  }
  if (filters.endDate) {
    conditions.push(lte(shiftExpenses.createdAt, new Date(filters.endDate + 'T23:59:59.999+07:00')))
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`
    conditions.push(
      or(ilike(shiftExpenses.note, pattern), ilike(shiftExpenses.categoryCustom, pattern)),
    )
  }

  const active = conditions.filter((c): c is SQL => c !== undefined)

  const rows = await db
    .select({
      id: shiftExpenses.id,
      shiftId: shiftExpenses.shiftId,
      shiftNumber: shifts.shiftNumber,
      shiftStatus: shifts.status,
      branchId: shifts.branchId,
      branchName: branches.name,
      cashierId: shiftExpenses.cashierId,
      cashierName: users.name,
      categoryId: shiftExpenses.categoryId,
      categoryName: expenseCategories.name,
      categoryCustom: shiftExpenses.categoryCustom,
      amount: shiftExpenses.amount,
      note: shiftExpenses.note,
      proofImage: shiftExpenses.proofImage,
      createdAt: shiftExpenses.createdAt,
    })
    .from(shiftExpenses)
    .innerJoin(shifts, eq(shiftExpenses.shiftId, shifts.id))
    .leftJoin(branches, eq(shifts.branchId, branches.id))
    .leftJoin(users, eq(shiftExpenses.cashierId, users.id))
    .leftJoin(expenseCategories, eq(shiftExpenses.categoryId, expenseCategories.id))
    .where(active.length > 0 ? and(...active) : undefined)
    .orderBy(desc(shiftExpenses.createdAt))
    .limit(filters.limit ?? 500)

  return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
}

export interface ExpenseContext {
  id: number
  shiftId: number
  branchId: number
  shiftStatus: string
  cashierId: number
  categoryId: number | null
  categoryCustom: string | null
  amount: number
  note: string
}

/** Ambil pengeluaran + status shift induknya dalam satu query. */
async function loadContext(expenseId: number): Promise<ExpenseContext> {
  const [row] = await db
    .select({
      id: shiftExpenses.id,
      shiftId: shiftExpenses.shiftId,
      branchId: shifts.branchId,
      shiftStatus: shifts.status,
      cashierId: shiftExpenses.cashierId,
      categoryId: shiftExpenses.categoryId,
      categoryCustom: shiftExpenses.categoryCustom,
      amount: shiftExpenses.amount,
      note: shiftExpenses.note,
    })
    .from(shiftExpenses)
    .innerJoin(shifts, eq(shiftExpenses.shiftId, shifts.id))
    .where(eq(shiftExpenses.id, expenseId))
    .limit(1)

  if (!row) throw new ShiftExpenseServiceError('NOT_FOUND')
  return { ...row, amount: Number(row.amount) }
}

/**
 * Pengeluaran hanya boleh diubah/dihapus selama shift induknya masih OPEN.
 *
 * Setelah settlement, angkanya sudah ikut dihitung ke `shift_cashier_breakdown` dan
 * `total_closing_cash_expected` — potret kas yang sudah direkonsiliasi dan dicetak. Mengubah
 * pengeluaran sesudah itu membuat total di laporan tidak lagi cocok dengan rinciannya, dan
 * selisihnya tidak bisa ditelusuri ke mana pun. Koreksi shift yang sudah tutup jalurnya
 * penyesuaian kas, bukan mengedit riwayat.
 */
export function assertMutable(
  ctx: Pick<ExpenseContext, 'branchId' | 'shiftStatus'>,
  allowedBranchId?: number,
) {
  if (allowedBranchId !== undefined && ctx.branchId !== allowedBranchId) {
    throw new ShiftExpenseServiceError('OUT_OF_SCOPE')
  }
  if (ctx.shiftStatus !== 'OPEN') {
    throw new ShiftExpenseServiceError('SHIFT_CLOSED')
  }
}

export interface UpdatePatch {
  amount?: number
  note?: string
  categoryId?: number | null
  categoryCustom?: string | null
}

export async function updateShiftExpense(
  expenseId: number,
  patch: UpdatePatch,
  actor: { userId: number },
  allowedBranchId?: number,
) {
  const ctx = await loadContext(expenseId)
  assertMutable(ctx, allowedBranchId)

  const values: Record<string, unknown> = {}
  if (patch.amount !== undefined) values.amount = patch.amount
  if (patch.note !== undefined) values.note = patch.note
  if (patch.categoryId !== undefined) values.categoryId = patch.categoryId
  if (patch.categoryCustom !== undefined) values.categoryCustom = patch.categoryCustom

  if (Object.keys(values).length === 0) return ctx

  return await db.transaction(async (trx) => {
    const [updated] = await trx
      .update(shiftExpenses)
      .set(values)
      .where(eq(shiftExpenses.id, expenseId))
      .returning()

    await trx.insert(auditLogs).values({
      branchId: ctx.branchId,
      userId: actor.userId,
      action: 'SHIFT_EXPENSE_UPDATED',
      tableName: 'shift_expenses',
      recordId: String(expenseId),
      oldData: JSON.stringify({
        amount: ctx.amount,
        note: ctx.note,
        categoryId: ctx.categoryId,
        categoryCustom: ctx.categoryCustom,
      }),
      newData: JSON.stringify(values),
    })

    return { ...updated, amount: Number(updated.amount) }
  })
}

export async function deleteShiftExpense(
  expenseId: number,
  actor: { userId: number },
  allowedBranchId?: number,
) {
  const ctx = await loadContext(expenseId)
  assertMutable(ctx, allowedBranchId)

  await db.transaction(async (trx) => {
    await trx.delete(shiftExpenses).where(eq(shiftExpenses.id, expenseId))

    await trx.insert(auditLogs).values({
      branchId: ctx.branchId,
      userId: actor.userId,
      action: 'SHIFT_EXPENSE_DELETED',
      tableName: 'shift_expenses',
      recordId: String(expenseId),
      oldData: JSON.stringify({
        shiftId: ctx.shiftId,
        cashierId: ctx.cashierId,
        amount: ctx.amount,
        note: ctx.note,
        categoryId: ctx.categoryId,
        categoryCustom: ctx.categoryCustom,
      }),
      newData: null,
    })
  })

  return { id: expenseId }
}
