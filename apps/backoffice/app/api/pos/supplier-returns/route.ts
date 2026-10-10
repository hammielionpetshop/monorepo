import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { handleSupplierReturnCreate } from '@/lib/supplier-return-http'
import { listSupplierReturns } from '@/lib/services/supplier-return-queries'

export const dynamic = 'force-dynamic'

async function auth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  return payload ? { payload, branchId: getPosBranchId(payload, cookieStore) } : null
}

/** Riwayat pengajuan retur cabang aktif (terbaru dulu). */
export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  try {
    return NextResponse.json({ data: await listSupplierReturns({ branchId: session.branchId, limit: 30 }) })
  } catch (error) {
    console.error('GET /api/pos/supplier-returns error:', error)
    return NextResponse.json({ error: 'Gagal mengambil riwayat retur supplier' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  return handleSupplierReturnCreate(req, { branchId: session.branchId, userId: session.payload.userId, source: 'POS' })
}
