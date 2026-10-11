import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { handleInternalReturnApprove } from '@/lib/internal-return-http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Penyetuju retur = penyetuju di Permintaan Persetujuan (OWNER/GM).
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  return handleInternalReturnApprove(req, Number(id), gate.userId)
}
