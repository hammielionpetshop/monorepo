import { NextRequest, NextResponse } from 'next/server'
import { listUndepositedShifts, summarizeUndeposited } from '@/lib/services/deposit-queries'
import { getDepositSettings } from '@/lib/services/deposit-service'
import { depositErrorResponse, requireDepositVerifier, scopedBranch } from '../_http'

export const dynamic = 'force-dynamic'

/** Tunai belum disetor: ringkasan per cabang + daftar shift. */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const settings = await getDepositSettings()
    const shifts = await listUndepositedShifts({ branchId: scopedBranch(gate, req.nextUrl.searchParams.get('branchId')), settings })
    return NextResponse.json({ settings, summary: summarizeUndeposited(shifts, settings), shifts })
  } catch (error) {
    return depositErrorResponse(error, 'GET /api/bo/deposits/undeposited')
  }
}
