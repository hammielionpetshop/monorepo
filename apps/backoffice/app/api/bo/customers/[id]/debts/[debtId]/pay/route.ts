import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, customerDebts, debtPayments, paymentMethods, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER', 'FINANCE']

const paySchema = z.object({
  amount: z.number().int('Nominal harus berupa bilangan bulat').positive('Nominal harus lebih dari 0'),
  paymentMethodId: z.number().int('Metode pembayaran tidak valid').positive('Metode pembayaran tidak valid'),
  note: z.string().trim().max(255, 'Keterangan maksimal 255 karakter').optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(payload.role)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Owner, GM, Manager, dan Finance yang dapat mencatat pembayaran hutang.' },
        { status: 403 }
      )
    }

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id, debtId } = await params
    if (!/^\d+$/.test(id) || !/^\d+$/.test(debtId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const customerId = Number(id)
    const debtIdNum = Number(debtId)

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

    const updated = await db.transaction(async (trx) => {
      const debtRows = await trx
        .select()
        .from(customerDebts)
        .where(eq(customerDebts.id, debtIdNum))
        .limit(1)

      const debt = debtRows[0]
      if (!debt) throw new Error('DEBT_NOT_FOUND')
      if (debt.customerId !== customerId) throw new Error('DEBT_NOT_FOUND')
      if (debt.status === 'PAID') throw new Error('DEBT_ALREADY_PAID')

      if (parsed.data.amount > debt.remainingAmount) {
        throw new Error('AMOUNT_EXCEEDS_REMAINING')
      }

      const pmRows = await trx
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, parsed.data.paymentMethodId))
        .limit(1)
      if (pmRows.length === 0) throw new Error('PAYMENT_METHOD_NOT_FOUND')

      await trx.insert(debtPayments).values({
        debtId: debtIdNum,
        amount: parsed.data.amount,
        paymentMethodId: parsed.data.paymentMethodId,
        note: parsed.data.note ?? null,
        createdBy: payload.userId,
      })

      const newPaidAmount = debt.paidAmount + parsed.data.amount
      const newRemainingAmount = debt.totalAmount - newPaidAmount
      const newStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIAL'

      const updatedRows = await trx
        .update(customerDebts)
        .set({
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        })
        .where(eq(customerDebts.id, debtIdNum))
        .returning()

      return updatedRows[0]
    })

    return NextResponse.json(updated, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'DEBT_NOT_FOUND') {
        return NextResponse.json({ error: 'Data hutang tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DEBT_ALREADY_PAID') {
        return NextResponse.json({ error: 'Hutang ini sudah lunas' }, { status: 409 })
      }
      if (error.message === 'AMOUNT_EXCEEDS_REMAINING') {
        return NextResponse.json({ error: 'Nominal melebihi sisa hutang' }, { status: 400 })
      }
      if (error.message === 'PAYMENT_METHOD_NOT_FOUND') {
        return NextResponse.json({ error: 'Metode pembayaran tidak ditemukan' }, { status: 400 })
      }
    }
    console.error('POST /api/bo/customers/[id]/debts/[debtId]/pay error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mencatat pembayaran hutang' }, { status: 500 })
  }
}
