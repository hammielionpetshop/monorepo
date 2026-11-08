import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requirePermission } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { cancelCashDeposit } from '@/lib/services/deposit-service'
import { actorOf, depositErrorResponse, idParam, reasonSchema } from '../../../../bo/deposits/_http'

export const dynamic = 'force-dynamic'

/** Batalkan laporan setoran cabang ini selama masih menunggu verifikasi. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('deposit.report')
  if (gate instanceof NextResponse) return gate
  try {
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID setoran tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, reasonSchema)
    if (data instanceof NextResponse) return data
    const branchId = getPosBranchId(gate, await cookies())
    const updated = await cancelCashDeposit(Number(id.data), data.reason, actorOf(gate), { branchId })
    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/pos/cash-deposits/[id]/cancel')
  }
}
