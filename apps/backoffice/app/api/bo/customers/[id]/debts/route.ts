import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, customers, customerDebts, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  totalAmount: z.number().int('Nominal harus berupa bilangan bulat').positive('Nominal harus lebih dari 0'),
  dueAt: z.string().nullable().optional(),
  note: z.string().trim().max(255, 'Keterangan maksimal 255 karakter').nullable().optional(),
})

export async function POST(
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
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const customerId = Number(id)

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

    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1)
    if (!customer) {
      return NextResponse.json({ error: 'Customer tidak ditemukan' }, { status: 404 })
    }

    const parsedDue = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null
    const dueAt = parsedDue && !Number.isNaN(parsedDue.getTime()) ? parsedDue : null

    const [created] = await db
      .insert(customerDebts)
      .values({
        customerId,
        transactionId: null,
        branchId: payload.branchId ?? null,
        totalAmount: parsed.data.totalAmount,
        paidAmount: 0,
        remainingAmount: parsed.data.totalAmount,
        status: 'UNPAID',
        dueAt,
        note: parsed.data.note ?? null,
        createdBy: payload.userId,
      })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/bo/customers/[id]/debts error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menambah hutang' }, { status: 500 })
  }
}
