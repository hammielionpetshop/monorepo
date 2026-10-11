import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { handleInternalReturnLookup } from '@/lib/internal-return-http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  return handleInternalReturnLookup(req, {
    userId: payload.userId,
    branchId: getPosBranchId(payload, cookieStore),
    allBranches: false,
  })
}
