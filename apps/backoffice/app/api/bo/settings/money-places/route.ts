import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { createMoneyPlace, listMoneyPlaces } from '@/lib/services/money-place-service'
import { moneyPlaceErrorResponse, moneyPlaceSchema } from './_http'

export const dynamic = 'force-dynamic'

// `?active=1` hanya yang aktif (untuk pilihan di layar lain).
export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission('money_place.read')
    if (gate instanceof NextResponse) return gate
    return NextResponse.json(await listMoneyPlaces({ activeOnly: req.nextUrl.searchParams.get('active') === '1' }))
  } catch (error) {
    return moneyPlaceErrorResponse(error, 'GET /api/bo/settings/money-places')
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePermission('money_place.manage')
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, moneyPlaceSchema)
    if (data instanceof NextResponse) return data
    const created = await createMoneyPlace(data, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return moneyPlaceErrorResponse(error, 'POST /api/bo/settings/money-places')
  }
}
