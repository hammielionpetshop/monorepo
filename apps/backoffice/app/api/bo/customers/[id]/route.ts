import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, customers, transactions, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter').optional(),
    code: z.string().trim().max(20, 'Kode maksimal 20 karakter').nullable().optional(),
    phone: z.string().trim().max(20, 'Nomor telepon maksimal 20 karakter').nullable().optional(),
    email: z
      .email('Format email tidak valid')
      .trim()
      .max(255, 'Email maksimal 255 karakter')
      .nullable()
      .optional()
      .or(z.literal('')),
    address: z.string().trim().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Minimal satu field harus diisi' })

export async function PUT(
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

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const customerId = Number(paramParsed.data.id)

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
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      if (parsed.data.code) {
        const duplicate = await trx
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.code, parsed.data.code), ne(customers.id, customerId)))
          .limit(1)
        if (duplicate.length > 0) throw new Error('DUPLICATE_CODE')
      }

      const rows = await trx
        .update(customers)
        .set({
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.code !== undefined && { code: parsed.data.code || null }),
          ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
          ...(parsed.data.email !== undefined && { email: parsed.data.email || null }),
          ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        })
        .where(eq(customers.id, customerId))
        .returning()

      if (!rows[0]) throw new Error('NOT_FOUND')
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_CODE') {
        return NextResponse.json({ error: 'Kode customer sudah digunakan' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Kode customer sudah digunakan' }, { status: 409 })
    }
    console.error('PUT /api/bo/customers/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data customer' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const customerId = Number(paramParsed.data.id)

    await db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      const linkedTrx = await trx
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.customerId, customerId))
        .limit(1)
      if (linkedTrx.length > 0) throw new Error('HAS_TRANSACTIONS')

      await trx.delete(customers).where(eq(customers.id, customerId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'HAS_TRANSACTIONS') {
        return NextResponse.json({ error: 'Customer memiliki riwayat transaksi dan tidak dapat dihapus' }, { status: 409 })
      }
    }
    console.error('DELETE /api/bo/customers/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus data customer' }, { status: 500 })
  }
}
