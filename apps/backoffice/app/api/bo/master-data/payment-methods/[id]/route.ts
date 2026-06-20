import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, paymentMethods, transactionPayments, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']

const PAYMENT_METHOD_TYPES = ['CASH', 'BANK_TRANSFER', 'E-WALLET', 'QRIS', 'DEBT'] as const

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z
  .object({
    name: z.string().trim().min(1, 'Nama wajib diisi').max(50, 'Nama maksimal 50 karakter').optional(),
    type: z.enum(PAYMENT_METHOD_TYPES, { message: 'Tipe metode pembayaran tidak valid' }).optional(),
  })
  .refine((data) => data.name !== undefined || data.type !== undefined, {
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
    const methodId = Number(paramParsed.data.id)

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
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, methodId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      if (parsed.data.name !== undefined) {
        const duplicate = await trx
          .select({ id: paymentMethods.id })
          .from(paymentMethods)
          .where(and(eq(paymentMethods.name, parsed.data.name), ne(paymentMethods.id, methodId)))
          .limit(1)
        if (duplicate.length > 0) throw new Error('DUPLICATE_NAME')
      }

      const updateData: { name?: string; type?: typeof PAYMENT_METHOD_TYPES[number] } = {}
      if (parsed.data.name !== undefined) updateData.name = parsed.data.name
      if (parsed.data.type !== undefined) updateData.type = parsed.data.type

      const rows = await trx
        .update(paymentMethods)
        .set(updateData)
        .where(eq(paymentMethods.id, methodId))
        .returning()
      if (!rows[0]) throw new Error('NOT_FOUND')
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Metode pembayaran tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    console.error('PATCH /api/bo/master-data/payment-methods/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data metode pembayaran' }, { status: 500 })
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

    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner dan GM yang dapat mengubah data master.' }, { status: 403 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const methodId = Number(paramParsed.data.id)

    await db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, methodId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      const linkedPayment = await trx
        .select({ id: transactionPayments.id })
        .from(transactionPayments)
        .where(eq(transactionPayments.paymentMethodId, methodId))
        .limit(1)
      if (linkedPayment.length > 0) throw new Error('HAS_TRANSACTIONS')

      await trx.delete(paymentMethods).where(eq(paymentMethods.id, methodId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Metode pembayaran tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'HAS_TRANSACTIONS') {
        return NextResponse.json({ error: 'Metode pembayaran sudah digunakan pada transaksi dan tidak dapat dihapus' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23503') {
      return NextResponse.json({ error: 'Metode pembayaran sudah digunakan pada transaksi dan tidak dapat dihapus' }, { status: 409 })
    }
    console.error('DELETE /api/bo/master-data/payment-methods/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus data metode pembayaran' }, { status: 500 })
  }
}
