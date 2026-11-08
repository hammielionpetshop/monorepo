import { NextRequest, NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { cancelCashDeposit } from '@/lib/services/deposit-service'
import { actorOf, depositErrorResponse, idParam, reasonSchema, requireDepositVerifier } from '../../_http'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID setoran tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, reasonSchema)
    if (data instanceof NextResponse) return data
    const updated = await cancelCashDeposit(Number(id.data), data.reason, actorOf(gate), {
      branchId: gate.branchScope === 'ALL' ? null : gate.branchId,
    })
    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/bo/deposits/[id]/cancel')
  }
}
