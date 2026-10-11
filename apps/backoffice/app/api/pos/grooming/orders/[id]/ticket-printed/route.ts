import { NextRequest, NextResponse } from 'next/server'
import { recordGroomingTicketPrint } from '@/lib/services/grooming-order-service'
import { groomingOrderErrorResponse, requireGroomingPos } from '@/lib/grooming-order-http'

export const dynamic = 'force-dynamic'

// Catat karcis dicetak. `printCount` > 1 = cetak ulang → karcis diberi tanda "CETAK ULANG".
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID grooming tidak valid' }, { status: 400 })
    const printCount = await recordGroomingTicketPrint(Number(id), gate)
    return NextResponse.json({ printCount, isReprint: printCount > 1 })
  } catch (error) {
    return groomingOrderErrorResponse(error, 'POST /api/pos/grooming/orders/[id]/ticket-printed')
  }
}
