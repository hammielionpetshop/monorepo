import { NextRequest, NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { listDeposits } from '@/lib/services/deposit-queries'
import { receiveCashDeposit } from '@/lib/services/deposit-service'
import { actorOf, assertBranchAllowed, depositErrorResponse, receiveSchema, requireDepositVerifier, scopedBranch } from './_http'

export const dynamic = 'force-dynamic'

const TABS: Record<string, string[]> = {
  pending: ['PENDING'],
  history: ['VERIFIED', 'CANCELLED', 'CORRECTED'],
}
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Daftar setoran tunai: `tab=pending` (Menunggu Verifikasi) atau `tab=history` (Riwayat). */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const sp = req.nextUrl.searchParams
    const from = sp.get('from')
    const to = sp.get('to')
    const items = await listDeposits({
      statuses: TABS[sp.get('tab') ?? 'pending'] ?? TABS.pending,
      branchId: scopedBranch(gate, sp.get('branchId')),
      from: from && DATE.test(from) ? from : null,
      to: to && DATE.test(to) ? to : null,
    })
    return NextResponse.json({ items })
  } catch (error) {
    return depositErrorResponse(error, 'GET /api/bo/deposits')
  }
}

/** Terima Setoran: uang diantar ke kantor / Bulk Sale Gudang — dibuat Finance, langsung terverifikasi. */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, receiveSchema)
    if (data instanceof NextResponse) return data
    const denied = assertBranchAllowed(gate, data.branchId)
    if (denied) return denied
    const created = await receiveCashDeposit(data, actorOf(gate))
    return NextResponse.json({ id: created.id, depositNumber: created.depositNumber }, { status: 201 })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/bo/deposits')
  }
}
