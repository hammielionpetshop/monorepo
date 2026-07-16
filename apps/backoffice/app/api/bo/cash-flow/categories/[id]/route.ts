import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, cashFlowCategories, cashFlowEntries, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter'),
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipe harus pendapatan atau pengeluaran' }),
})

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

    const updated = await db.transaction(async (trx) => {
      const existing = await trx.select({ id: cashFlowCategories.id }).from(cashFlowCategories).where(eq(cashFlowCategories.id, categoryId)).limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      const duplicate = await trx
        .select({ id: cashFlowCategories.id })
        .from(cashFlowCategories)
        .where(and(eq(cashFlowCategories.name, parsed.data.name), eq(cashFlowCategories.type, parsed.data.type), ne(cashFlowCategories.id, categoryId)))
        .limit(1)
      if (duplicate.length > 0) throw new Error('DUPLICATE_NAME')

      const rows = await trx.update(cashFlowCategories).set({ name: parsed.data.name, type: parsed.data.type }).where(eq(cashFlowCategories.id, categoryId)).returning()
      if (!rows[0]) throw new Error('NOT_FOUND')
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return NextResponse.json({ error: 'Nama kategori sudah digunakan untuk tipe ini' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama kategori sudah digunakan untuk tipe ini' }, { status: 409 })
    }
    console.error('PATCH /api/bo/cash-flow/categories/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui kategori' }, { status: 500 })
  }
}

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
      const existing = await trx.select({ id: cashFlowCategories.id }).from(cashFlowCategories).where(eq(cashFlowCategories.id, categoryId)).limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      const used = await trx.select({ id: cashFlowEntries.id }).from(cashFlowEntries).where(eq(cashFlowEntries.categoryId, categoryId)).limit(1)
      if (used.length > 0) throw new Error('IN_USE')

      await trx.delete(cashFlowCategories).where(eq(cashFlowCategories.id, categoryId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'IN_USE') {
        return NextResponse.json({ error: 'Kategori tidak dapat dihapus karena sudah dipakai pada transaksi kas' }, { status: 409 })
      }
    }
    console.error('DELETE /api/bo/cash-flow/categories/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus kategori' }, { status: 500 })
  }
}
