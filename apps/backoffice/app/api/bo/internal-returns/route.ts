import { NextResponse } from 'next/server'
import { getAuth, hasPermission } from '@/lib/authz'
import { handleReturnedGoodsCreate } from '@/lib/internal-return-http'
import { INTERNAL_RETURN_STATUSES, listInternalReturns, type InternalReturnStatus } from '@/lib/services/internal-return-queries'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  const status = new URL(req.url).searchParams.get('status')
  if (status && !INTERNAL_RETURN_STATUSES.includes(status as InternalReturnStatus)) {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
  }
  try {
    // Penyetuju (Permintaan Persetujuan) melihat semua cabang, sama seperti antrean void.
    const allBranches = payload.branchScope === 'ALL' || hasPermission(payload, 'void.approve')
    const data = await listInternalReturns({
      status: (status as InternalReturnStatus | null) ?? undefined,
      branchId: allBranches ? null : payload.branchId,
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/bo/internal-returns error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar retur internal' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  return handleReturnedGoodsCreate(req, {
    actor: { userId: payload.userId, branchId: payload.branchId, allBranches: payload.branchScope === 'ALL' },
    source: 'BO',
  })
}
