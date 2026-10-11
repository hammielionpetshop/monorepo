import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { handleInternalReturnWithdraw } from '@/lib/internal-return-http'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  return handleInternalReturnWithdraw((await params).id, payload.userId)
}
