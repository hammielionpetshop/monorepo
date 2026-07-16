import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, suppliers, purchaseOrders, eq, and, ne } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Nama supplier wajib diisi').max(100, 'Nama maksimal 100 karakter').optional(),
  phone: z.string().trim().max(20, 'Nomor telepon maksimal 20 karakter').nullable().optional(),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid')
    .max(255, 'Email maksimal 255 karakter')
    .nullable()
    .optional()
    .or(z.literal('')),
  contactPerson: z.string().trim().max(100, 'Nama kontak maksimal 100 karakter').nullable().optional(),
  bankAccount: z.string().trim().max(100, 'Rekening bank maksimal 100 karakter').nullable().optional(),
  address: z.string().trim().nullable().optional(),
  paymentTermDays: z.number().int('Termin pembayaran harus bilangan bulat').min(0, 'Termin pembayaran minimal 0 hari').max(365, 'Termin pembayaran maksimal 365 hari').nullable().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('master.supplier.manage')
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
    const supplierId = Number(paramParsed.data.id)

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
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      if (parsed.data.name) {
        const duplicate = await trx
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(and(eq(suppliers.name, parsed.data.name), ne(suppliers.id, supplierId)))
          .limit(1)
        if (duplicate.length > 0) throw new Error('DUPLICATE_NAME')
      }

      const rows = await trx
        .update(suppliers)
        .set({
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
          ...(parsed.data.email !== undefined && { email: parsed.data.email || null }),
          ...(parsed.data.contactPerson !== undefined && { contactPerson: parsed.data.contactPerson || null }),
          ...(parsed.data.bankAccount !== undefined && { bankAccount: parsed.data.bankAccount || null }),
          ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
          ...(parsed.data.paymentTermDays !== undefined && { paymentTermDays: parsed.data.paymentTermDays }),
        })
        .where(eq(suppliers.id, supplierId))
        .returning()

      if (!rows[0]) throw new Error('NOT_FOUND')
      return rows
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Supplier tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_NAME') {
        return NextResponse.json({ error: 'Nama supplier sudah digunakan' }, { status: 409 })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama supplier sudah digunakan' }, { status: 409 })
    }
    console.error('PUT /api/bo/master-data/suppliers/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui data supplier' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('master.supplier.manage')
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const supplierId = Number(paramParsed.data.id)

    await db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      const linkedPO = await trx
        .select({ id: purchaseOrders.id })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.supplierId, supplierId))
        .limit(1)
      if (linkedPO.length > 0) throw new Error('HAS_PURCHASE_ORDERS')

      await trx.delete(suppliers).where(eq(suppliers.id, supplierId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Supplier tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'HAS_PURCHASE_ORDERS') {
        return NextResponse.json({ error: 'Supplier memiliki riwayat purchase order dan tidak dapat dihapus' }, { status: 409 })
      }
    }
    console.error('DELETE /api/bo/master-data/suppliers/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus data supplier' }, { status: 500 })
  }
}
