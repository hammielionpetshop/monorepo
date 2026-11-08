import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, expenseCategories, cashFlowCategories, eq, asc } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * F2-4b §3.4: tiap kategori Pengeluaran Kasir (laci) disambungkan ke satu kategori Arus Kas agar satu biaya
 * hanya punya satu nama di Finance. Tampilan kasir tidak berubah; pengeluaran laci tidak disalin ke Arus Kas.
 */
export async function GET() {
  const gate = await requirePermission('cashflow.category.manage')
  if (gate instanceof NextResponse) return gate
  try {
    const rows = await db
      .select({
        id: expenseCategories.id,
        name: expenseCategories.name,
        cashFlowCategoryId: expenseCategories.cashFlowCategoryId,
      })
      .from(expenseCategories)
      .orderBy(asc(expenseCategories.name))
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/bo/cash-flow/expense-links error:', error)
    return NextResponse.json({ error: 'Gagal mengambil kategori Pengeluaran Kasir' }, { status: 500 })
  }
}

const putSchema = z.object({
  expenseCategoryId: z.number().int().positive(),
  cashFlowCategoryId: z.number().int().positive().nullable(),
})

export async function PUT(req: NextRequest) {
  const gate = await requirePermission('cashflow.category.manage')
  if (gate instanceof NextResponse) return gate
  try {
    const parsed = putSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    const { expenseCategoryId, cashFlowCategoryId } = parsed.data

    if (cashFlowCategoryId !== null) {
      const [target] = await db
        .select({ type: cashFlowCategories.type, isSystem: cashFlowCategories.isSystem })
        .from(cashFlowCategories)
        .where(eq(cashFlowCategories.id, cashFlowCategoryId))
        .limit(1)
      if (!target) return NextResponse.json({ error: 'Kategori Arus Kas tidak ditemukan' }, { status: 404 })
      if (target.type !== 'EXPENSE' || target.isSystem) {
        return NextResponse.json({ error: 'Pilih kategori pengeluaran biasa (bukan pendapatan atau kategori sistem)' }, { status: 400 })
      }
    }

    const updated = await db
      .update(expenseCategories)
      .set({ cashFlowCategoryId })
      .where(eq(expenseCategories.id, expenseCategoryId))
      .returning({ id: expenseCategories.id })
    if (updated.length === 0) return NextResponse.json({ error: 'Kategori Pengeluaran Kasir tidak ditemukan' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/bo/cash-flow/expense-links error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan sambungan kategori' }, { status: 500 })
  }
}
