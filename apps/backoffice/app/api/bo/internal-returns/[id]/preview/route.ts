import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { internalReturnHttpError } from '@/lib/internal-return-http'
import { previewPriceRevision } from '@/lib/services/internal-price-revision-service'

export const dynamic = 'force-dynamic'

/** Pratinjau popup penyetuju Revisi Harga Beli: harga yang berlaku & sisa stok kiriman saat ini. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }
  try {
    return NextResponse.json(await previewPriceRevision(Number(id)))
  } catch (error) {
    return internalReturnHttpError(error, 'Gagal menghitung pratinjau revisi harga', 'GET /api/bo/internal-returns/[id]/preview')
  }
}
