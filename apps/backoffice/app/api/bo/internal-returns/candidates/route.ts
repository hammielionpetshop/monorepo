import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { handleInternalReturnCandidates } from '@/lib/internal-return-http'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  return handleInternalReturnCandidates({
    userId: payload.userId,
    branchId: payload.branchId,
    allBranches: payload.branchScope === 'ALL',
  })
}
