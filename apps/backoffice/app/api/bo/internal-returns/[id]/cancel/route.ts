import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { internalReturnHttpError, readJsonBody } from '@/lib/internal-return-http'
import { cancelReturnedGoods } from '@/lib/services/internal-return-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string().trim().min(5, 'Alasan pembatalan wajib diisi (minimal 5 huruf)').max(500, 'Alasan maksimal 500 karakter'),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Pembatal = penyetuju retur (OWNER/GM).
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID retur tidak valid' }, { status: 400 })
  }
  const raw = await readJsonBody(req)
  if (raw instanceof NextResponse) return raw
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  try {
    const data = await cancelReturnedGoods({ id: Number(id), userId: gate.userId, reason: parsed.data.reason })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return internalReturnHttpError(error, 'Gagal membatalkan retur internal', 'POST /api/bo/internal-returns/[id]/cancel')
  }
}
