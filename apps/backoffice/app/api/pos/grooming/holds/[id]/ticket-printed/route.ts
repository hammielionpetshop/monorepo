import { NextRequest, NextResponse } from 'next/server'
import { recordHoldTicketPrint } from '@/lib/services/grooming-hold-service'
import { groomingOrderErrorResponse, requireGroomingPos } from '@/lib/grooming-order-http'

export const dynamic = 'force-dynamic'

// Catat karcis tahanan dicetak. `printCount` > 1 = cetak ulang → karcis bertanda "CETAK ULANG".
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID tahanan tidak valid' }, { status: 400 })
    const printCount = await recordHoldTicketPrint(Number(id), gate)
    return NextResponse.json({ printCount, isReprint: printCount > 1 })
  } catch (error) {
    return groomingOrderErrorResponse(error, 'POST /api/pos/grooming/holds/[id]/ticket-printed')
  }
}
