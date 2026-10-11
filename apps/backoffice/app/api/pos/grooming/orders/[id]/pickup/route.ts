import { NextRequest, NextResponse } from 'next/server'
import { markGroomingPickedUp } from '@/lib/services/grooming-order-service'
import { groomingOrderErrorResponse, requireGroomingPos } from '@/lib/grooming-order-http'

export const dynamic = 'force-dynamic'

// Tandai kucing sudah diambil. Tidak menyentuh uang: pelunasan nota yang belum dibayar tetap
// lewat jalur piutang yang sudah ada.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID grooming tidak valid' }, { status: 400 })
    return NextResponse.json(await markGroomingPickedUp(Number(id), gate))
  } catch (error) {
    return groomingOrderErrorResponse(error, 'POST /api/pos/grooming/orders/[id]/pickup')
  }
}
