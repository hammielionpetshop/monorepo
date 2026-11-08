import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { setMoneyPlaceActive } from '@/lib/services/money-place-service'
import { idParam, moneyPlaceErrorResponse } from '../../_http'

export const dynamic = 'force-dynamic'

const schema = z.object({ isActive: z.boolean() })

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('money_place.manage')
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!idParam.safeParse(id).success) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    return NextResponse.json(await setMoneyPlaceActive(Number(id), data.isActive, { userId: gate.userId, branchId: gate.branchId }))
  } catch (error) {
    return moneyPlaceErrorResponse(error, 'PUT /api/bo/settings/money-places/[id]/active')
  }
}
