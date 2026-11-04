import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { db, transactions, eq } from '@/lib/db'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { DELIVERY_REASON_MAX, DeliveryMethodError } from '@/lib/delivery-method'
import { changeTransactionDeliveryMethod } from '@/lib/delivery-method-server'

export const dynamic = 'force-dynamic'

const schema = z.object({
  deliveryMethod: z.string().min(1, 'Pilih cara kirim'),
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(DELIVERY_REASON_MAX, 'Alasan terlalu panjang'),
})

// Ubah cara kirim nota (jalan keluar salah tandai). Batas siapa & kapan di deliveryChangeProblem.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ trxNumber: string }> }) {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data

    const { trxNumber } = await params
    const [trx] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.trxNumber, trxNumber))
      .limit(1)
    if (!trx) return NextResponse.json({ error: 'Nota tidak ditemukan' }, { status: 404 })

    const result = await changeTransactionDeliveryMethod(payload, {
      transactionId: trx.id,
      newMethod: data.deliveryMethod,
      reason: data.reason,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DeliveryMethodError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('PATCH /api/bo/transactions/[trxNumber]/delivery-method error:', error)
    return NextResponse.json({ error: 'Gagal mengubah cara kirim' }, { status: 500 })
  }
}
