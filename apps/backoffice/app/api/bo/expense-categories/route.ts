import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, expenseCategories } from '@/lib/db'
import { isUniqueViolation, linkTargetProblem, nameSchema } from './shared'

export const dynamic = 'force-dynamic'

const postSchema = z.object({
  name: nameSchema,
  cashFlowCategoryId: z.number().int().positive().nullable().optional(),
})

/** Tambah kategori Pengeluaran Kasir (permintaan owner 2026-11-14); langsung bisa dipilih kasir. */
export async function POST(req: NextRequest) {
  const gate = await requirePermission('cashflow.category.manage')
  if (gate instanceof NextResponse) return gate
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  const { name, cashFlowCategoryId = null } = parsed.data
  try {
    if (cashFlowCategoryId !== null) {
      const problem = await linkTargetProblem(cashFlowCategoryId)
      if (problem) return NextResponse.json({ error: problem }, { status: 400 })
    }
    const [created] = await db
      .insert(expenseCategories)
      .values({ name, cashFlowCategoryId })
      .returning({ id: expenseCategories.id, name: expenseCategories.name, cashFlowCategoryId: expenseCategories.cashFlowCategoryId, isActive: expenseCategories.isActive })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ error: 'Nama kategori sudah dipakai' }, { status: 409 })
    console.error('POST /api/bo/expense-categories error:', error)
    return NextResponse.json({ error: 'Gagal menambah kategori Pengeluaran Kasir' }, { status: 500 })
  }
}
