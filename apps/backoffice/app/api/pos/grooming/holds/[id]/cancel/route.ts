import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cancelGroomingHold, HOLD_CANCEL_REASON_MAX } from '@/lib/services/grooming-hold-service'
import { groomingOrderErrorResponse, requireGroomingPos } from '@/lib/grooming-order-http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  reason: z.string().trim().min(3, 'Tulis alasan pembatalan (minimal 3 huruf)').max(HOLD_CANCEL_REASON_MAX, 'Alasan terlalu panjang'),
})

// Batalkan Grooming Ditahan (belum bernota, jadi tidak ada uang/stok yang dibalik). Alasan wajib.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID tahanan tidak valid' }, { status: 400 })
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Alasan tidak valid' }, { status: 400 })
    }
    return NextResponse.json(await cancelGroomingHold(Number(id), parsed.data.reason, gate))
  } catch (error) {
    return groomingOrderErrorResponse(error, 'POST /api/pos/grooming/holds/[id]/cancel')
  }
}
