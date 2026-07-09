import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, brands, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter'),
})

export async function GET() {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const result = await db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(brands.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/brands error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data brand' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('master.brand.manage')
    if (gate instanceof NextResponse) return gate

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const result = await db.transaction(async (trx) => {
      const existing = await trx.select({ id: brands.id }).from(brands).where(eq(brands.name, parsed.data.name)).limit(1)
      if (existing.length > 0) throw new Error('DUPLICATE_NAME')

      return await trx.insert(brands).values({ name: parsed.data.name }).returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'DUPLICATE_NAME') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/master-data/brands error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data brand' }, { status: 500 })
  }
}
