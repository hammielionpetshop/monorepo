import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, shiftCashierSessions, eq, and } from '@/lib/db'
import { findOpenShiftId } from '@/lib/services/shift-resolver'
import { getPaymentMethodForDebt, payCustomerDebtsAtPos } from '@/lib/services/pos-debt-service'

export const dynamic = 'force-dynamic'

const paySchema = z.object({
  amount: z.number().int('Nominal harus berupa bilangan bulat').positive('Nominal harus lebih dari 0'),
  paymentMethodId: z.number().int('Metode pembayaran tidak valid').positive('Metode pembayaran tidak valid'),
  note: z.string().trim().max(255, 'Keterangan maksimal 255 karakter').optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requirePermission('debt.pay')
  if (gate instanceof NextResponse) return gate
  const payload = gate

  try {
    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'ID pelanggan tidak valid' }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = paySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const method = await getPaymentMethodForDebt(parsed.data.paymentMethodId)
    if (!method) {
      return NextResponse.json({ error: 'Metode pembayaran tidak ditemukan' }, { status: 400 })
    }
    if (method.type === 'DEBT') {
      return NextResponse.json({ error: 'Piutang tidak bisa dilunasi dengan metode hutang' }, { status: 400 })
    }

    // Uang pelunasan masuk laci kasir, jadi wajib ada shift terbuka di cabang POS ini dan
    // penerimanya harus kasir aktif di shift itu — sama seperti syarat mencatat transaksi.
    const branchId = getPosBranchId(payload, await cookies())
    let shiftId: number | null
    try {
      shiftId = await findOpenShiftId(db, branchId)
    } catch (e) {
      if (e instanceof Error && e.message === 'MULTIPLE_OPEN_SHIFTS') {
        return NextResponse.json(
          { error: 'Ada lebih dari satu shift aktif di cabang ini, tutup salah satunya dulu' },
          { status: 409 }
        )
      }
      throw e
    }
    if (shiftId === null) {
      return NextResponse.json({ error: 'Belum ada shift aktif di cabang ini. Buka shift dulu.' }, { status: 409 })
    }

    const [session] = await db
      .select({ cashierId: shiftCashierSessions.cashierId })
      .from(shiftCashierSessions)
      .where(
        and(
          eq(shiftCashierSessions.shiftId, shiftId),
          eq(shiftCashierSessions.cashierId, payload.userId),
          eq(shiftCashierSessions.status, 'ACTIVE'),
        ),
      )
      .limit(1)
    if (!session) {
      return NextResponse.json({ error: 'Anda belum bergabung di shift yang sedang berjalan' }, { status: 403 })
    }

    const result = await payCustomerDebtsAtPos({
      customerId: Number(id),
      amount: parsed.data.amount,
      paymentMethodId: method.id,
      note: parsed.data.note || null,
      branchId,
      shiftId,
      userId: payload.userId,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NO_ACTIVE_DEBT') {
        return NextResponse.json({ error: 'Pelanggan ini tidak punya piutang aktif di cabang ini' }, { status: 400 })
      }
      if (error.message === 'AMOUNT_EXCEEDS_REMAINING') {
        return NextResponse.json({ error: 'Nominal melebihi total sisa piutang' }, { status: 400 })
      }
    }
    console.error('POST /api/pos/customers/[id]/debts/pay error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mencatat pelunasan piutang' }, { status: 500 })
  }
}
