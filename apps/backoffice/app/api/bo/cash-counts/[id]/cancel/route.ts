import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cancelCashCount } from '@/lib/services/cash-count-service'
import { cashCountActorOf, cashCountErrorResponse, requireCashCountManager } from '@/lib/services/cash-count-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string({ message: 'Alasan pembatalan wajib diisi' }).trim().min(3, 'Alasan pembatalan wajib diisi (minimal 3 huruf)').max(200),
})

/** Batalkan hitungan (Owner/GM); penyesuaian aktifnya ikut batal. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCashCountManager()
  if (gate instanceof NextResponse) return gate
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Hitungan tidak valid' }, { status: 400 })
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    await cancelCashCount(id, parsed.data.reason, cashCountActorOf(gate))
    return NextResponse.json({ success: true })
  } catch (error) {
    return cashCountErrorResponse(error, 'POST /api/bo/cash-counts/[id]/cancel', 'Gagal membatalkan hitungan')
  }
}
