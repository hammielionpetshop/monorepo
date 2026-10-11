import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { internalReturnHttpError } from '@/lib/internal-return-http'
import { approveReturnedGoods } from '@/lib/services/internal-return-service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Penyetuju retur = penyetuju di Permintaan Persetujuan (OWNER/GM).
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  try {
    const data = await approveReturnedGoods({ id: Number(id), userId: gate.userId })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return internalReturnHttpError(error, 'Gagal menyetujui retur internal', 'POST /api/bo/internal-returns/[id]/approve')
  }
}
