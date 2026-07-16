import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, paymentMethods, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PAYMENT_METHOD_TYPES = ['CASH', 'BANK_TRANSFER', 'E-WALLET', 'QRIS', 'DEBT'] as const

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter'),
  type: z.enum(PAYMENT_METHOD_TYPES, { message: 'Tipe metode pembayaran tidak valid' }),
})

export async function GET() {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const result = await db
      .select({
        id: paymentMethods.id,
        name: paymentMethods.name,
        type: paymentMethods.type,
      })
      .from(paymentMethods)
      .orderBy(paymentMethods.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/payment-methods error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data metode pembayaran' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('master.payment_method.manage')
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
      const existingName = await trx
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.name, parsed.data.name))
        .limit(1)
      if (existingName.length > 0) throw new Error('DUPLICATE_NAME')

      return await trx
        .insert(paymentMethods)
        .values({
          name: parsed.data.name,
          type: parsed.data.type,
        })
        .returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'DUPLICATE_NAME') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/master-data/payment-methods error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data metode pembayaran' }, { status: 500 })
  }
}
