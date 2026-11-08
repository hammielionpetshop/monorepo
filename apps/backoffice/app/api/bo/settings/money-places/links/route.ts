import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { getPaymentLinkMatrix, setPaymentLink } from '@/lib/services/money-place-service'
import { moneyPlaceErrorResponse } from '../_http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  paymentMethodId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  moneyPlaceId: z.number().int().positive().nullable(),
})

export async function GET() {
  try {
    const gate = await requirePermission('money_place.read')
    if (gate instanceof NextResponse) return gate
    return NextResponse.json(await getPaymentLinkMatrix())
  } catch (error) {
    return moneyPlaceErrorResponse(error, 'GET /api/bo/settings/money-places/links')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const gate = await requirePermission('money_place.manage')
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    await setPaymentLink(data, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json(await getPaymentLinkMatrix())
  } catch (error) {
    return moneyPlaceErrorResponse(error, 'PUT /api/bo/settings/money-places/links')
  }
}
