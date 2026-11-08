import { NextRequest, NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { listDeposits } from '@/lib/services/deposit-queries'
import { verifyCashDeposit } from '@/lib/services/deposit-service'
import { actorOf, assertBranchAllowed, depositErrorResponse, idParam, requireDepositVerifier, verifySchema } from '../../_http'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID setoran tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, verifySchema)
    if (data instanceof NextResponse) return data
    const [current] = await listDeposits({ statuses: ['PENDING'], branchId: null, depositId: Number(id.data) })
    if (current) {
      const denied = assertBranchAllowed(gate, current.branchId)
      if (denied) return denied
    }
    const updated = await verifyCashDeposit(Number(id.data), data, actorOf(gate))
    return NextResponse.json({ id: updated.id, status: updated.status, settlement: updated.settlement })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/bo/deposits/[id]/verify')
  }
}
