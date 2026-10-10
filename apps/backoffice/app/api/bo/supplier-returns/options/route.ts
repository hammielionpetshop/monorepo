import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { handleSupplierReturnOptions, positiveInt, resolveBoBranch } from '@/lib/supplier-return-http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  const branchId = await resolveBoBranch(payload, positiveInt(new URL(req.url).searchParams.get('branchId')))
  if (branchId instanceof NextResponse) return branchId
  return handleSupplierReturnOptions(req, branchId)
}
