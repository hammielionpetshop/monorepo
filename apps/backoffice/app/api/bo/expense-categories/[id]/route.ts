import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, expenseCategories, eq } from '@/lib/db'
import { isUniqueViolation, nameSchema } from '../shared'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: nameSchema.optional(),
  isActive: z.boolean().optional(),
}).refine((d) => d.name !== undefined || d.isActive !== undefined, { message: 'Tidak ada yang diubah' })

/**
 * Ganti nama atau nonaktifkan/aktifkan kategori Pengeluaran Kasir. Tidak ada hapus: catatan lama tetap memakai
 * kategorinya. Ganti nama ikut mengubah nama di catatan lama, jadi untuk kategori yang isinya berubah (mis. Listrik &
 * Air dipisah) buat kategori baru dan nonaktifkan yang lama.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('cashflow.category.manage')
  if (gate instanceof NextResponse) return gate
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  try {
    const [updated] = await db
      .update(expenseCategories)
      .set(parsed.data)
      .where(eq(expenseCategories.id, id))
      .returning({ id: expenseCategories.id, name: expenseCategories.name, cashFlowCategoryId: expenseCategories.cashFlowCategoryId, isActive: expenseCategories.isActive })
    if (!updated) return NextResponse.json({ error: 'Kategori Pengeluaran Kasir tidak ditemukan' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: 'Nama kategori sudah dipakai' }, { status: 409 })
    console.error('PATCH /api/bo/expense-categories/[id] error:', error)
    return NextResponse.json({ error: 'Gagal mengubah kategori Pengeluaran Kasir' }, { status: 500 })
  }
}
