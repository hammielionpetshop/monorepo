import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, categories, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter'),
})

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const result = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/categories error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data kategori' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
      const existing = await trx.select({ id: categories.id }).from(categories).where(eq(categories.name, parsed.data.name)).limit(1)
      if (existing.length > 0) throw new Error('DUPLICATE_NAME')

      return await trx.insert(categories).values({ name: parsed.data.name }).returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'DUPLICATE_NAME') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/master-data/categories error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data kategori' }, { status: 500 })
  }
}
