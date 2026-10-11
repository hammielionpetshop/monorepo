import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { handleInternalReturnCancel, readJsonBody } from '@/lib/internal-return-http'

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
  return handleInternalReturnCancel(Number(id), gate.userId, parsed.data.reason)
}
