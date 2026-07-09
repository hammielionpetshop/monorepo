import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, unitsOfMeasure, products, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z
  .object({
    code: z.string().trim().min(1, 'Kode wajib diisi').max(10, 'Kode maksimal 10 karakter').transform(s => s.toUpperCase()).optional(),
    name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter').optional(),
    isBase: z.boolean().optional(),
  })
  .refine((data) => data.code !== undefined || data.name !== undefined || data.isBase !== undefined, {
    message: 'Minimal satu field harus diisi',
  })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('master.uom.manage')
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
    const uomId = Number(paramParsed.data.id)

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
      const existing = await trx
        .select({ id: unitsOfMeasure.id })
        .from(unitsOfMeasure)
        .where(eq(unitsOfMeasure.id, uomId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      if (parsed.data.code !== undefined) {
        const duplicate = await trx
          .select({ id: unitsOfMeasure.id })
          .from(unitsOfMeasure)
          .where(and(eq(unitsOfMeasure.code, parsed.data.code), ne(unitsOfMeasure.id, uomId)))
          .limit(1)
        if (duplicate.length > 0) throw new Error('DUPLICATE_CODE')
      }

      if (parsed.data.name !== undefined) {
        const duplicateName = await trx
          .select({ id: unitsOfMeasure.id })
          .from(unitsOfMeasure)
          .where(and(eq(unitsOfMeasure.name, parsed.data.name), ne(unitsOfMeasure.id, uomId)))
          .limit(1)
        if (duplicateName.length > 0) throw new Error('DUPLICATE_NAME')
      }

      if (parsed.data.isBase === false) {
        const productUsage = await trx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.baseUomId, uomId))
          .limit(1)
        if (productUsage.length > 0) throw new Error('ISBASE_IN_USE')
      }

      const updateData: { code?: string; name?: string; isBase?: boolean } = {}
      if (parsed.data.code !== undefined) updateData.code = parsed.data.code
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name
      if (parsed.data.isBase !== undefined) updateData.isBase = parsed.data.isBase

      const rows = await trx
        .update(unitsOfMeasure)
        .set(updateData)
        .where(eq(unitsOfMeasure.id, uomId))
        .returning()
      if (!rows[0]) throw new Error('NOT_FOUND')
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Satuan ukur tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_CODE') {
        return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
      }
      if (error.message === 'ISBASE_IN_USE') {
        return NextResponse.json({ error: 'UOM ini masih digunakan sebagai satuan dasar oleh beberapa produk. Ubah produk tersebut terlebih dahulu.' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Kode atau nama sudah digunakan' }, { status: 409 })
    }
    console.error('PATCH /api/bo/master-data/uom/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data satuan ukur' }, { status: 500 })
  }
}
