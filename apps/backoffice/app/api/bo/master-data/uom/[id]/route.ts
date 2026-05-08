import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, unitsOfMeasure, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

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
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner dan GM yang dapat mengubah data master.' }, { status: 403 })
    }

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

      const updateData: { code?: string; name?: string; isBase?: boolean } = {}
      if (parsed.data.code !== undefined) updateData.code = parsed.data.code
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name
      if (parsed.data.isBase !== undefined) updateData.isBase = parsed.data.isBase

      return await trx
        .update(unitsOfMeasure)
        .set(updateData)
        .where(eq(unitsOfMeasure.id, uomId))
        .returning()
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
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Kode sudah digunakan' }, { status: 409 })
    }
    console.error('PATCH /api/bo/master-data/uom/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data satuan ukur' }, { status: 500 })
  }
}
