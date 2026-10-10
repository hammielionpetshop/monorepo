import { NextResponse } from 'next/server'
import { getAuth, hasPermission } from '@/lib/authz'
import { handleSupplierReturnCreate } from '@/lib/supplier-return-http'
import { listSupplierReturns, type SupplierReturnStatus } from '@/lib/services/supplier-return-queries'

export const dynamic = 'force-dynamic'

const STATUSES: SupplierReturnStatus[] = ['PENDING', 'APPROVED', 'REJECTED']

export async function GET(req: Request) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  const status = new URL(req.url).searchParams.get('status')
  if (status && !STATUSES.includes(status as SupplierReturnStatus)) {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
  }
  try {
    // Penyetuju (Permintaan Persetujuan) melihat semua cabang, sama seperti antrean void.
    const allBranches = payload.branchScope === 'ALL' || hasPermission(payload, 'void.approve')
    const data = await listSupplierReturns({
      status: (status as SupplierReturnStatus | null) ?? undefined,
      branchId: allBranches ? null : payload.branchId,
    })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/bo/supplier-returns error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar retur supplier' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  return handleSupplierReturnCreate(req, { branchId: payload.branchId, userId: payload.userId, source: 'BO' })
}
