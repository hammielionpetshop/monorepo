import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { listCashDepositDefaults } from '@/lib/services/deposit-queries'
import { setCashDepositDefault } from '@/lib/services/deposit-service'
import { actorOf, depositErrorResponse } from '../../../deposits/_http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  branchId: z.number().int().positive(),
  moneyPlaceId: z.number().int().positive().nullable(),
})

/** Baris Tunai di Metode Bayar per Cabang: tujuan bawaan setoran tunai (F2-2). */
export async function GET() {
  try {
    const gate = await requirePermission('money_place.read')
    if (gate instanceof NextResponse) return gate
    return NextResponse.json({ defaults: await listCashDepositDefaults() })
  } catch (error) {
    return depositErrorResponse(error, 'GET /api/bo/settings/money-places/cash-defaults')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const gate = await requirePermission('money_place.manage')
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    await setCashDepositDefault(data, actorOf(gate))
    return NextResponse.json({ defaults: await listCashDepositDefaults() })
  } catch (error) {
    return depositErrorResponse(error, 'PUT /api/bo/settings/money-places/cash-defaults')
  }
}
