import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { internalReturnHttpError, readJsonBody } from '@/lib/internal-return-http'
import { rejectInternalReturn } from '@/lib/services/internal-return-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  rejectionReason: z.string().trim().min(1, 'Alasan penolakan wajib diisi').max(500),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  const raw = await readJsonBody(req)
  if (raw instanceof NextResponse) return raw
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  try {
    const data = await rejectInternalReturn({ id: Number(id), userId: gate.userId, rejectionReason: parsed.data.rejectionReason })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return internalReturnHttpError(error, 'Gagal menolak retur internal', 'POST /api/bo/internal-returns/[id]/reject')
  }
}
