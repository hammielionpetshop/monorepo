import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, expenseCategories, eq } from '@/lib/db'
import {
  MAX_AMOUNT,
  ShiftExpenseServiceError,
  deleteShiftExpense,
  updateShiftExpense,
} from '@/lib/services/shift-expense-service'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    amount: z
      .number({ message: 'Jumlah wajib diisi' })
      .int('Jumlah harus berupa angka bulat')
      .positive('Jumlah harus lebih dari 0')
      .max(MAX_AMOUNT, 'Jumlah pengeluaran melebihi batas maksimum yang diperbolehkan')
      .optional(),
    note: z
      .string()
      .trim()
      .min(1, 'Keterangan wajib diisi')
      .max(255, 'Keterangan maksimal 255 karakter')
      .optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    categoryCustom: z
      .string()
      .trim()
      .max(100, 'Kategori maksimal 100 karakter')
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Tidak ada perubahan yang dikirim' })

/** Terjemahkan kegagalan service ke respons HTTP yang bisa dibaca kasir/atasan. */
function toErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ShiftExpenseServiceError)) return null
  if (error.code === 'NOT_FOUND') {
    return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
  }
  if (error.code === 'OUT_OF_SCOPE') {
    return NextResponse.json({ error: 'Pengeluaran ini bukan milik cabang Anda' }, { status: 403 })
  }
  return NextResponse.json(
    {
      error:
        'Shift-nya sudah ditutup, jadi pengeluaran ini tidak bisa diubah lagi. Angkanya sudah ikut ' +
        'terhitung di rekonsiliasi kas shift tersebut — koreksinya lewat penyesuaian kas, bukan mengubah riwayat.',
    },
    { status: 409 },
  )
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('shift_expense.manage')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id } = await params
    const expenseId = parseInt(id, 10)
    if (Number.isNaN(expenseId)) {
      return NextResponse.json({ error: 'ID pengeluaran tidak valid' }, { status: 400 })
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }

    if (parsed.data.categoryId) {
      const [category] = await db
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(eq(expenseCategories.id, parsed.data.categoryId))
        .limit(1)
      if (!category) {
        return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 400 })
      }
    }

    const allowedBranchId = payload.branchScope === 'ALL' ? undefined : payload.branchId
    const updated = await updateShiftExpense(
      expenseId,
      parsed.data,
      { userId: payload.userId },
      allowedBranchId,
    )

    return NextResponse.json(updated)
  } catch (error: unknown) {
    const mapped = toErrorResponse(error)
    if (mapped) return mapped
    console.error('[bo/shift-expenses/[id]] PATCH error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan perubahan pengeluaran' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('shift_expense.manage')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id } = await params
    const expenseId = parseInt(id, 10)
    if (Number.isNaN(expenseId)) {
      return NextResponse.json({ error: 'ID pengeluaran tidak valid' }, { status: 400 })
    }

    const allowedBranchId = payload.branchScope === 'ALL' ? undefined : payload.branchId
    await deleteShiftExpense(expenseId, { userId: payload.userId }, allowedBranchId)

    return NextResponse.json({ ok: true, id: expenseId })
  } catch (error: unknown) {
    const mapped = toErrorResponse(error)
    if (mapped) return mapped
    console.error('[bo/shift-expenses/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Gagal menghapus pengeluaran' }, { status: 500 })
  }
}
