import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, suppliers, ilike, or } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nama supplier wajib diisi').max(100, 'Nama maksimal 100 karakter'),
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

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    const baseQuery = db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        phone: suppliers.phone,
        email: suppliers.email,
        contactPerson: suppliers.contactPerson,
        bankAccount: suppliers.bankAccount,
        address: suppliers.address,
        paymentTermDays: suppliers.paymentTermDays,
      })
      .from(suppliers)

    const result = q
      ? await baseQuery.where(
          or(
            ilike(suppliers.name, `%${q}%`),
            ilike(suppliers.phone, `%${q}%`),
            ilike(suppliers.contactPerson, `%${q}%`)
          )
        ).orderBy(suppliers.name)
      : await baseQuery.orderBy(suppliers.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/suppliers error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data supplier' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('master.supplier.manage')
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
      return await trx
        .insert(suppliers)
        .values({
          name: parsed.data.name,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          contactPerson: parsed.data.contactPerson || null,
          bankAccount: parsed.data.bankAccount || null,
          address: parsed.data.address || null,
          paymentTermDays: parsed.data.paymentTermDays ?? 30,
        })
        .returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'Nama supplier sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/master-data/suppliers error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data supplier' }, { status: 500 })
  }
}
