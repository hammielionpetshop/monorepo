import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { getDepositSettings, setDepositSettings } from '@/lib/services/deposit-service'
import { actorOf, depositErrorResponse, isoDate, requireDepositVerifier } from '../_http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  startDate: isoDate,
  warnDays: z.number().int(),
  warnAmount: z.number().int(),
  awaitingFundsDays: z.number().int(),
})

export async function GET() {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    return NextResponse.json(await getDepositSettings())
  } catch (error) {
    return depositErrorResponse(error, 'GET /api/bo/deposits/settings')
  }
}

/** Owner/GM (diperiksa di layanan). */
export async function PUT(req: NextRequest) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    return NextResponse.json(await setDepositSettings(data, actorOf(gate)))
  } catch (error) {
    return depositErrorResponse(error, 'PUT /api/bo/deposits/settings')
  }
}
