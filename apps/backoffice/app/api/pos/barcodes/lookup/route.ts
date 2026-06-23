import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { findProductByBarcode } from '@/lib/services/barcode'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const code = req.nextUrl.searchParams.get('code')?.trim() ?? ''
  if (!code) {
    return NextResponse.json({ error: 'Kode barcode wajib diisi' }, { status: 400 })
  }

  const branchId = getPosBranchId(payload, cookieStore)
  const product = await findProductByBarcode(code, branchId)

  if (!product) {
    return NextResponse.json({ error: 'Produk dengan barcode ini tidak ditemukan' }, { status: 404 })
  }

  return NextResponse.json(product)
}
