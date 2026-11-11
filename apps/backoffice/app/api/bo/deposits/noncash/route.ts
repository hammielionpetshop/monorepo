import { NextRequest, NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { listNoncashRows } from '@/lib/services/deposit-queries'
import { listSettlementLines } from '@/lib/services/deposit-settlement-service'
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
    const ids = rows.filter((r) => r.status === 'VERIFIED' && r.verificationId != null).map((r) => r.verificationId as number)
    const lines = await listSettlementLines(ids.map((id) => ({ sourceType: 'NONCASH_VERIFICATION' as const, sourceId: id })))
    return NextResponse.json({
      rows: rows.map((r) => ({ ...r, settlements: r.verificationId != null ? lines.get(`NONCASH_VERIFICATION:${r.verificationId}`) ?? [] : [] })),
    })
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
    return NextResponse.json({ id: row.id, status: row.status, settlement: 'settlement' in row ? row.settlement : null })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/bo/deposits/noncash')
  }
}
