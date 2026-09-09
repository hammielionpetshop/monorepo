import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, customerDebts, debtPayments, paymentMethods, eq, and, notInArray, asc } from '@/lib/db'
import { findOpenShiftId, resolveShiftId } from '@/lib/services/shift-resolver'
import { alokasiPembayaranHutang } from '@/lib/debt-payment-alloc'

export const dynamic = 'force-dynamic'

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const paySchema = z.object({
  amount: z.number().int('Nominal harus berupa bilangan bulat').positive('Nominal harus lebih dari 0'),
  paymentMethodId: z.number().int('Metode pembayaran tidak valid').positive('Metode pembayaran tidak valid'),
  note: z.string().trim().max(255, 'Keterangan maksimal 255 karakter').optional(),
})

const activeColumns = {
  id: customerDebts.id,
  branchId: customerDebts.branchId,
  createdAt: customerDebts.createdAt,
  totalAmount: customerDebts.totalAmount,
  paidAmount: customerDebts.paidAmount,
  remainingAmount: customerDebts.remainingAmount,
  status: customerDebts.status,
}

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

    const parsed = paySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { amount, paymentMethodId, note } = parsed.data

    // Validasi & penentuan shift dilakukan sebelum transaksi DB dibuka: resolveShiftId
    // membuka transaksinya sendiri, jadi tidak boleh dipanggil sambil memegang lock baris.
    const active = await db
      .select(activeColumns)
      .from(customerDebts)
      .where(and(eq(customerDebts.customerId, customerId), notInArray(customerDebts.status, ['PAID', 'VOIDED'])))
      .orderBy(asc(customerDebts.createdAt), asc(customerDebts.id))

    if (active.length === 0) {
      return NextResponse.json({ error: 'Tidak ada hutang aktif untuk dilunasi' }, { status: 400 })
    }

    const totalOutstanding = active.reduce((sum, d) => sum + d.remainingAmount, 0)
    if (amount > totalOutstanding) {
      return NextResponse.json(
        { error: `Nominal melebihi total hutang (${IDR.format(totalOutstanding)})` },
        { status: 400 }
      )
    }

    const [method] = await db
      .select({ id: paymentMethods.id, type: paymentMethods.type })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, paymentMethodId))
      .limit(1)
    if (!method) {
      return NextResponse.json({ error: 'Metode pembayaran tidak ditemukan' }, { status: 400 })
    }

    // Cabang penerima uang per baris: cabang asal hutang, atau cabang user bila hutang lama
    // belum bercabang. Pelunasan tunai wajib menempel ke shift; buka shift BACKOFFICE bila
    // cabang itu belum menjalankan shift. Non-tunai hanya menempel bila ada shift terbuka.
    const activeById = new Map(active.map((d) => [d.id, d]))
    const preAlloc = alokasiPembayaranHutang(active, amount)
    const touchedBranches = new Set<number>()
    for (const a of preAlloc.alokasi) {
      const debt = activeById.get(a.debtId)
      if (debt) touchedBranches.add(debt.branchId ?? payload.branchId)
    }

    const shiftByBranch = new Map<number, number | null>()
    try {
      for (const branchId of touchedBranches) {
        const shiftId = method.type === 'CASH'
          ? await resolveShiftId(branchId, payload.userId)
          : await findOpenShiftId(db, branchId)
        shiftByBranch.set(branchId, shiftId)
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'MULTIPLE_OPEN_SHIFTS') {
        return NextResponse.json(
          { error: 'Ada lebih dari satu shift aktif di cabang ini, tutup salah satunya dulu' },
          { status: 409 }
        )
      }
      throw e
    }

    const result = await db.transaction(async (trx) => {
      const locked = await trx
        .select(activeColumns)
        .from(customerDebts)
        .where(and(eq(customerDebts.customerId, customerId), notInArray(customerDebts.status, ['PAID', 'VOIDED'])))
        .orderBy(asc(customerDebts.createdAt), asc(customerDebts.id))
        .for('update')

      const outstandingNow = locked.reduce((sum, d) => sum + d.remainingAmount, 0)
      if (amount > outstandingNow) throw new Error('AMOUNT_EXCEEDS_REMAINING')

      const { alokasi } = alokasiPembayaranHutang(locked, amount)
      if (alokasi.length === 0) throw new Error('NO_ACTIVE_DEBT')

      const lockedById = new Map(locked.map((d) => [d.id, d]))
      const payments = []
      for (const a of alokasi) {
        const debt = lockedById.get(a.debtId)
        if (!debt) throw new Error('SHIFT_RESOLUTION_STALE')
        const branchId = debt.branchId ?? payload.branchId
        if (!shiftByBranch.has(branchId)) throw new Error('SHIFT_RESOLUTION_STALE')

        const [createdPayment] = await trx
          .insert(debtPayments)
          .values({
            debtId: a.debtId,
            branchId,
            shiftId: shiftByBranch.get(branchId) ?? null,
            amount: a.bayar,
            paymentMethodId,
            note: note ?? null,
            createdBy: payload.userId,
          })
          .returning()

        await trx
          .update(customerDebts)
          .set({
            paidAmount: a.paidAmountBaru,
            remainingAmount: a.remainingAmountBaru,
            status: a.statusBaru,
          })
          .where(eq(customerDebts.id, a.debtId))

        payments.push(createdPayment)
      }

      return {
        totalPaid: alokasi.reduce((sum, a) => sum + a.bayar, 0),
        settledCount: alokasi.filter((a) => a.statusBaru === 'PAID').length,
        touchedCount: alokasi.length,
        debts: alokasi.map((a) => ({
          id: a.debtId,
          paidAmount: a.paidAmountBaru,
          remainingAmount: a.remainingAmountBaru,
          status: a.statusBaru,
        })),
        payments,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'AMOUNT_EXCEEDS_REMAINING') {
        return NextResponse.json(
          { error: 'Total hutang berubah, nominal kini melebihi sisa. Muat ulang halaman.' },
          { status: 409 }
        )
      }
      if (error.message === 'NO_ACTIVE_DEBT') {
        return NextResponse.json({ error: 'Tidak ada hutang aktif untuk dilunasi' }, { status: 400 })
      }
      if (error.message === 'SHIFT_RESOLUTION_STALE') {
        return NextResponse.json({ error: 'Data hutang berubah saat diproses, coba lagi' }, { status: 409 })
      }
    }
    console.error('POST /api/bo/customers/[id]/debts/pay-bulk error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mencatat pembayaran hutang' }, { status: 500 })
  }
}
