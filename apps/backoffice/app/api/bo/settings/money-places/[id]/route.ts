import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { updateMoneyPlace } from '@/lib/services/money-place-service'
import { idParam, moneyPlaceErrorResponse, moneyPlaceSchema } from '../_http'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('money_place.manage')
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!idParam.safeParse(id).success) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, moneyPlaceSchema)
    if (data instanceof NextResponse) return data
    return NextResponse.json(await updateMoneyPlace(Number(id), data, { userId: gate.userId, branchId: gate.branchId }))
  } catch (error) {
    return moneyPlaceErrorResponse(error, 'PATCH /api/bo/settings/money-places/[id]')
  }
}
