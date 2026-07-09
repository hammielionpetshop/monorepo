import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, categories, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter'),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('master.category.manage')
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
      const existing = await trx.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      const duplicate = await trx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.name, parsed.data.name), ne(categories.id, categoryId)))
        .limit(1)
      if (duplicate.length > 0) throw new Error('DUPLICATE_NAME')

      const rows = await trx.update(categories).set({ name: parsed.data.name }).where(eq(categories.id, categoryId)).returning()
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
        return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    console.error('PATCH /api/bo/master-data/categories/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data kategori' }, { status: 500 })
  }
}
