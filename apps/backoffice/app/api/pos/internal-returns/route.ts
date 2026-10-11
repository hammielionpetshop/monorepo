import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { handleReturnedGoodsCreate } from '@/lib/internal-return-http'
import { listInternalReturns } from '@/lib/services/internal-return-queries'

export const dynamic = 'force-dynamic'

async function auth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  return payload ? { payload, branchId: getPosBranchId(payload, cookieStore) } : null
}

/** Riwayat retur internal yang melibatkan cabang aktif (terbaru dulu). */
export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  try {
    return NextResponse.json({ data: await listInternalReturns({ branchId: session.branchId, limit: 30 }) })
  } catch (error) {
    console.error('GET /api/pos/internal-returns error:', error)
    return NextResponse.json({ error: 'Gagal mengambil riwayat retur internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  // POS selalu atas nama cabang aktif: hanya kiriman dari / ke cabang itu.
  return handleReturnedGoodsCreate(req, {
    actor: { userId: session.payload.userId, branchId: session.branchId, allBranches: false },
    source: 'POS',
  })
}
