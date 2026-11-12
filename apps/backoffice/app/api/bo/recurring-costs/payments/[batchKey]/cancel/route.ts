import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, hasPermission } from '@/lib/authz'
import { cancelRecurringCostPayment } from '@/lib/services/recurring-cost-service'
import { costActorOf, recurringCostErrorResponse } from '@/lib/recurring-cost-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string({ message: 'Alasan pembatalan wajib diisi' }).trim().min(3, 'Alasan pembatalan wajib diisi (minimal 3 huruf)').max(255),
})

/** Batalkan pembayaran (semua bulan dalam satu kali bayar); catatan Arus Kas ikut bertanda Batal. */
export async function POST(req: Request, { params }: { params: Promise<{ batchKey: string }> }) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!hasPermission(payload, 'cashflow.record') && !hasPermission(payload, 'cashflow.cancel')) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }
  const { batchKey } = await params
  if (!/^[0-9a-f-]{36}$/.test(batchKey)) return NextResponse.json({ error: 'Pembayaran tidak valid' }, { status: 400 })
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    await cancelRecurringCostPayment(batchKey, parsed.data.reason, costActorOf(payload))
    return NextResponse.json({ success: true })
  } catch (error) {
    return recurringCostErrorResponse(error, 'POST /api/bo/recurring-costs/payments/[batchKey]/cancel', 'Gagal membatalkan pembayaran')
  }
}
