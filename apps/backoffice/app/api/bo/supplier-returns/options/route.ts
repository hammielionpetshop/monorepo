import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { handleSupplierReturnOptions } from '@/lib/supplier-return-http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  return handleSupplierReturnOptions(req, payload.branchId)
}
