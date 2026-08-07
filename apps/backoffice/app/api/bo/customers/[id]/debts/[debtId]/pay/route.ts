import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, customerDebts, debtPayments, paymentMethods, eq } from '@/lib/db'
import { findOpenShiftId, resolveShiftId } from '@/lib/services/shift-resolver'

export const dynamic = 'force-dynamic'

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

    // Validasi awal & penentuan shift dilakukan sebelum transaksi DB dibuka: resolveShiftId
    // membuka transaksinya sendiri, jadi tidak boleh dipanggil sambil memegang lock baris hutang.
    const [preDebt] = await db
      .select({
        id: customerDebts.id,
        customerId: customerDebts.customerId,
        branchId: customerDebts.branchId,
        status: customerDebts.status,
        remainingAmount: customerDebts.remainingAmount,
      })
      .from(customerDebts)
      .where(eq(customerDebts.id, debtIdNum))
      .limit(1)

    if (!preDebt || preDebt.customerId !== customerId) {
      return NextResponse.json({ error: 'Data hutang tidak ditemukan' }, { status: 404 })
    }
    if (preDebt.status === 'PAID') {
      return NextResponse.json({ error: 'Hutang ini sudah lunas' }, { status: 409 })
    }
    if (parsed.data.amount > preDebt.remainingAmount) {
      return NextResponse.json({ error: 'Nominal melebihi sisa hutang' }, { status: 400 })
    }

    const [method] = await db
      .select({ id: paymentMethods.id, type: paymentMethods.type })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, parsed.data.paymentMethodId))
      .limit(1)
    if (!method) {
      return NextResponse.json({ error: 'Metode pembayaran tidak ditemukan' }, { status: 400 })
    }

    // Cabang penerima uang: cabang asal hutang, atau cabang user bila hutang lama belum bercabang.
    const branchId = preDebt.branchId ?? payload.branchId

    // Pelunasan tunai menambah isi laci, jadi wajib punya shift — buka shift BACKOFFICE bila cabang
    // itu belum menjalankan shift. Non-tunai tidak menyentuh laci: hanya ikut menempel bila
    // kebetulan ada shift terbuka, supaya tidak membuka shift kosong tanpa guna.
    let shiftId: number | null = null
    try {
      shiftId = method.type === 'CASH'
        ? await resolveShiftId(branchId, payload.userId)
        : await findOpenShiftId(db, branchId)
    } catch (e) {
      if (e instanceof Error && e.message === 'MULTIPLE_OPEN_SHIFTS') {
        return NextResponse.json(
          { error: 'Ada lebih dari satu shift aktif di cabang ini, tutup salah satunya dulu' },
          { status: 409 }
        )
      }
      throw e
    }

    const updated = await db.transaction(async (trx) => {
      const debtRows = await trx
        .select()
        .from(customerDebts)
        .where(eq(customerDebts.id, debtIdNum))
        .for('update')
        .limit(1)

      const debt = debtRows[0]
      if (!debt) throw new Error('DEBT_NOT_FOUND')
      if (debt.customerId !== customerId) throw new Error('DEBT_NOT_FOUND')
      if (debt.status === 'PAID') throw new Error('DEBT_ALREADY_PAID')

      if (parsed.data.amount > debt.remainingAmount) {
        throw new Error('AMOUNT_EXCEEDS_REMAINING')
      }

      const [createdPayment] = await trx.insert(debtPayments).values({
        debtId: debtIdNum,
        branchId,
        shiftId,
        amount: parsed.data.amount,
        paymentMethodId: parsed.data.paymentMethodId,
        note: parsed.data.note ?? null,
        createdBy: payload.userId,
      }).returning()

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

      return { ...updatedRows[0], payment: createdPayment }
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
    }
    console.error('POST /api/bo/customers/[id]/debts/[debtId]/pay error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mencatat pembayaran hutang' }, { status: 500 })
  }
}
