import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, customers, eq, or, ilike } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_CREATE_ROLES = ['OWNER', 'GM', 'MANAGER', 'FINANCE']

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  code: z.string().trim().max(20, 'Kode maksimal 20 karakter').nullable().optional(),
  phone: z.string().trim().max(20, 'Nomor telepon maksimal 20 karakter').nullable().optional(),
  email: z.email('Format email tidak valid').trim().max(255, 'Email maksimal 255 karakter').nullable().optional().or(z.literal('')),
  address: z.string().trim().nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const isActiveParam = searchParams.get('isActive')

    const conditions = []

    if (q) {
      conditions.push(
        or(
          ilike(customers.name, `%${q}%`),
          ilike(customers.phone, `%${q}%`),
          ilike(customers.code, `%${q}%`)
        )
      )
    }

    if (isActiveParam === 'true') {
      conditions.push(eq(customers.isActive, true))
    } else if (isActiveParam === 'false') {
      conditions.push(eq(customers.isActive, false))
    }

    const query = db
      .select({
        id: customers.id,
        code: customers.code,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
      })
      .from(customers)

    const result = conditions.length > 0
      ? await query.where(conditions.length === 1 ? conditions[0]! : conditions.reduce((acc, c) => acc && c))
      : await query

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/customers error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data customer' }, { status: 500 })
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

    if (!ALLOWED_CREATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner, GM, Manager, dan Finance yang dapat menambah customer.' }, { status: 403 })
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
      let code = parsed.data.code || null

      if (code) {
        const existing = await trx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.code, code))
          .limit(1)
        if (existing.length > 0) throw new Error('DUPLICATE_CODE')
      } else {
        let generated: string | null = null
        for (let i = 0; i < 5; i++) {
          const digits = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
          const candidate = `CST-${digits}`
          const existing = await trx
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.code, candidate))
            .limit(1)
          if (existing.length === 0) { generated = candidate; break }
        }
        if (!generated) throw new Error('GENERATE_CODE_FAILED')
        code = generated
      }

      return await trx
        .insert(customers)
        .values({
          code,
          name: parsed.data.name,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
        })
        .returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'DUPLICATE_CODE') {
      return NextResponse.json({ error: 'Kode customer sudah digunakan' }, { status: 409 })
    }
    if (error instanceof Error && error.message === 'GENERATE_CODE_FAILED') {
      return NextResponse.json({ error: 'Gagal menghasilkan kode customer unik, silakan coba lagi' }, { status: 500 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Kode customer sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/customers error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data customer' }, { status: 500 })
  }
}
