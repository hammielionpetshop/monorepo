import { NextRequest, NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { listNoncashRows } from '@/lib/services/deposit-queries'
import { saveNoncashVerification } from '@/lib/services/deposit-service'
import { actorOf, assertBranchAllowed, depositErrorResponse, noncashSchema, requireDepositVerifier, scopedBranch } from '../_http'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Non-tunai per shift per metode (+ baris Pelunasan BO per cabang per hari). */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const sp = req.nextUrl.searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    const method = sp.get('paymentMethodId')
    const rows = await listNoncashRows({
      branchId: scopedBranch(gate, sp.get('branchId')),
      from: from && DATE.test(from) ? from : null,
      to: to && DATE.test(to) ? to : null,
      paymentMethodId: method && /^\d+$/.test(method) ? Number(method) : null,
    })
    return NextResponse.json({ rows })
  } catch (error) {
    return depositErrorResponse(error, 'GET /api/bo/deposits/noncash')
  }
}

/** Simpan Dana belum cair atau Verifikasi satu baris non-tunai. */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, noncashSchema)
    if (data instanceof NextResponse) return data
    const denied = assertBranchAllowed(gate, data.branchId)
    if (denied) return denied
    const row = await saveNoncashVerification(data, actorOf(gate))
    return NextResponse.json({ id: row.id, status: row.status })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/bo/deposits/noncash')
  }
}
