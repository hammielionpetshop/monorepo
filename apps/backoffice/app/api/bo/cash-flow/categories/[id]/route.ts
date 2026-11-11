import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { checkCategoryChange } from '@/lib/services/cash-flow-rules'
import { db, cashFlowCategories, cashFlowEntries, expenseCategories, eq, and, ne, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter'),
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipe harus pendapatan atau pengeluaran' }),
  reportKind: z.enum(['COST', 'NON_COST', 'INCOME', 'NON_INCOME']).nullable(),
  isActive: z.boolean(),
  ownerOnly: z.boolean(),
  noteRequired: z.boolean(),
})

class CategoryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function usedCount(trx: Pick<typeof db, 'select'>, categoryId: number): Promise<number> {
  const [row] = await trx
    .select({ n: sql<number>`count(*)::int` })
    .from(cashFlowEntries)
    .where(eq(cashFlowEntries.categoryId, categoryId))
  return row?.n ?? 0
}

/**
 * Ubah kategori (F2-4b): nama, aktif, hanya Owner, catatan wajib kapan saja; tipe & jenis laporan hanya
 * selama belum dipakai (jenis yang masih kosong boleh dipilih kapan saja). Kategori sistem hanya ganti nama.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('cashflow.category.manage')
    if (gate instanceof NextResponse) return gate

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const categoryId = Number(paramParsed.data.id)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const next = parsed.data

    const updated = await db.transaction(async (trx) => {
      const [current] = await trx
        .select({ type: cashFlowCategories.type, reportKind: cashFlowCategories.reportKind, isSystem: cashFlowCategories.isSystem })
        .from(cashFlowCategories)
        .where(eq(cashFlowCategories.id, categoryId))
        .for('update')
        .limit(1)
      if (!current) throw new CategoryError('Kategori tidak ditemukan', 404)

      const error = checkCategoryChange({ current, next, usedCount: await usedCount(trx, categoryId) })
      if (error) throw new CategoryError(error, 409)
      if (current.isSystem && (!next.isActive || next.ownerOnly || next.noteRequired)) {
        throw new CategoryError('Kategori sistem hanya bisa diganti namanya', 409)
      }

      const duplicate = await trx
        .select({ id: cashFlowCategories.id })
        .from(cashFlowCategories)
        .where(and(eq(cashFlowCategories.name, next.name), eq(cashFlowCategories.type, next.type), ne(cashFlowCategories.id, categoryId)))
        .limit(1)
      if (duplicate.length > 0) throw new CategoryError('Nama kategori sudah digunakan untuk tipe ini', 409)

      const rows = await trx
        .update(cashFlowCategories)
        .set({
          name: next.name,
          type: next.type,
          reportKind: next.reportKind,
          isActive: next.isActive,
          ownerOnly: next.ownerOnly,
          noteRequired: next.noteRequired,
        })
        .where(eq(cashFlowCategories.id, categoryId))
        .returning()
      if (!rows[0]) throw new CategoryError('Kategori tidak ditemukan', 404)
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof CategoryError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama kategori sudah digunakan untuk tipe ini' }, { status: 409 })
    }
    console.error('PATCH /api/bo/cash-flow/categories/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui kategori' }, { status: 500 })
  }
}

/** Hapus hanya kategori yang belum pernah dipakai & bukan sistem; selain itu Nonaktifkan. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('cashflow.category.manage')
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const categoryId = Number(paramParsed.data.id)

    await db.transaction(async (trx) => {
      const [existing] = await trx
        .select({ isSystem: cashFlowCategories.isSystem })
        .from(cashFlowCategories)
        .where(eq(cashFlowCategories.id, categoryId))
        .limit(1)
      if (!existing) throw new CategoryError('Kategori tidak ditemukan', 404)
      if (existing.isSystem) throw new CategoryError('Kategori sistem tidak bisa dihapus', 409)
      if ((await usedCount(trx, categoryId)) > 0) {
        throw new CategoryError('Kategori sudah dipakai, jadi tidak bisa dihapus — Nonaktifkan saja', 409)
      }
      const linked = await trx
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(eq(expenseCategories.cashFlowCategoryId, categoryId))
        .limit(1)
      if (linked.length > 0) {
        throw new CategoryError('Kategori masih disambungkan ke kategori Pengeluaran Kasir; lepas dulu sambungannya', 409)
      }

      await trx.delete(cashFlowCategories).where(eq(cashFlowCategories.id, categoryId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof CategoryError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('DELETE /api/bo/cash-flow/categories/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus kategori' }, { status: 500 })
  }
}
