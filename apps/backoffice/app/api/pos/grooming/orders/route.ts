import { NextRequest, NextResponse } from 'next/server'
import { listGroomingOrders, listGroomingOrdersOfTransaction } from '@/lib/services/grooming-order-service'
import { groomingOrderErrorResponse, requireGroomingPos, wibDayStart } from '@/lib/grooming-order-http'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

// Daftar grooming cabang POS yang sedang aktif.
//   ?view=aktif    → kucing yang masih di toko ("Sedang Dikerjakan")
//   ?view=selesai  → sudah diambil / dibatalkan ("Sudah Selesai"); ?from=&to= (YYYY-MM-DD, WIB)
//   ?transactionId → semua grooming pada satu nota (untuk mencetak karcis)
export async function GET(req: NextRequest) {
  try {
    const gate = await requireGroomingPos()
    if (gate instanceof NextResponse) return gate
    const { searchParams } = req.nextUrl

    const transactionId = searchParams.get('transactionId')
    if (transactionId) {
      if (!/^\d+$/.test(transactionId)) return NextResponse.json({ error: 'ID nota tidak valid' }, { status: 400 })
      return NextResponse.json(await listGroomingOrdersOfTransaction(Number(transactionId), gate.branchId))
    }

    const view = searchParams.get('view') === 'selesai' ? 'SELESAI' : 'AKTIF'
    const from = wibDayStart(searchParams.get('from'))
    const toDay = wibDayStart(searchParams.get('to'))
    return NextResponse.json(await listGroomingOrders({
      branchId: gate.branchId,
      view,
      q: (searchParams.get('q') ?? '').slice(0, 100) || undefined,
      from: from ?? undefined,
      to: toDay ? new Date(toDay.getTime() + DAY_MS) : undefined,
    }))
  } catch (error) {
    return groomingOrderErrorResponse(error, 'GET /api/pos/grooming/orders')
  }
}
