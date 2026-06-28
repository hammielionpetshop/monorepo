import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, cashFlowCategories, and, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM', 'MANAGER']

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter'),
  type: z.enum(['INCOME', 'EXPENSE'], { message: 'Tipe harus pendapatan atau pengeluaran' }),
})

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const typeParam = req.nextUrl.searchParams.get('type')
    const where = typeParam === 'INCOME' || typeParam === 'EXPENSE'
      ? eq(cashFlowCategories.type, typeParam)
      : undefined

    const result = await db
      .select({ id: cashFlowCategories.id, name: cashFlowCategories.name, type: cashFlowCategories.type })
      .from(cashFlowCategories)
      .where(where)
      .orderBy(cashFlowCategories.type, cashFlowCategories.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/cash-flow/categories error:', error)
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
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner, GM, dan Manager yang dapat mengubah kategori.' }, { status: 403 })
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
      const existing = await trx
        .select({ id: cashFlowCategories.id })
        .from(cashFlowCategories)
        .where(and(eq(cashFlowCategories.name, parsed.data.name), eq(cashFlowCategories.type, parsed.data.type)))
        .limit(1)
      if (existing.length > 0) throw new Error('DUPLICATE_NAME')

      return await trx.insert(cashFlowCategories).values({ name: parsed.data.name, type: parsed.data.type }).returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'DUPLICATE_NAME') {
      return NextResponse.json({ error: 'Nama kategori sudah digunakan untuk tipe ini' }, { status: 409 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama kategori sudah digunakan untuk tipe ini' }, { status: 409 })
    }
    console.error('POST /api/bo/cash-flow/categories error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan kategori' }, { status: 500 })
  }
}
