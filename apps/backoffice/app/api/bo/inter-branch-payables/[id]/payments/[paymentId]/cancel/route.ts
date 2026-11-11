import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { cancelInterBranchPayment, PaymentCancelError } from '@/lib/services/inter-branch-payment-cancel'

export const dynamic = 'force-dynamic'

const schema = z.object({
  reason: z
    .string({ message: 'Alasan pembatalan wajib diisi' })
    .trim()
    .min(5, 'Alasan pembatalan wajib diisi (minimal 5 huruf)')
    .max(500, 'Alasan maksimal 500 karakter'),
})

// Batalkan pembayaran manual Utang Internal (Owner/GM, tanpa batas waktu). Tidak ada yang dihapus:
// baris BATAL_BAYAR negatif + catatan Arus Kas asal ditandai Batal.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const gate = await requirePermission('payable.payment_cancel')
  if (gate instanceof NextResponse) return gate
  const payload = gate

  const { id, paymentId } = await params
  const payableIdNum = Number(id)
  const paymentIdNum = Number(paymentId)
  if (!Number.isInteger(payableIdNum) || payableIdNum <= 0 || !Number.isInteger(paymentIdNum) || paymentIdNum <= 0) {
    return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  try {
    const result = await cancelInterBranchPayment({
      payableId: payableIdNum,
      paymentId: paymentIdNum,
      reason: parsed.data.reason,
      userId: payload.userId,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PaymentCancelError) return NextResponse.json({ error: error.message }, { status: error.status })
    // Dua pembatalan bersamaan untuk pembayaran yang sama: yang kalah kena UNIQUE reversal_of_payment_id.
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Pembayaran ini sudah dibatalkan' }, { status: 409 })
    }
    console.error('POST inter-branch-payables payment cancel error:', error)
    return NextResponse.json({ error: 'Gagal membatalkan pembayaran' }, { status: 500 })
  }
}
