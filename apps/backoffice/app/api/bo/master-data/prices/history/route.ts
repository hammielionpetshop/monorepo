import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/authz'
import { getPriceHistory } from '@/lib/services/price-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const ids = ['branchId', 'productId', 'uomId'].map((k) => searchParams.get(k) ?? '')
  if (ids.some((v) => !/^\d+$/.test(v))) {
    return NextResponse.json({ error: 'branchId, productId, dan uomId wajib diisi' }, { status: 400 })
  }
  const [branchId, productId, uomId] = ids.map(Number)

  try {
    const data = await getPriceHistory({ branchId, productId, uomId })
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/bo/master-data/prices/history error:', error)
    return NextResponse.json({ error: 'Gagal mengambil riwayat harga' }, { status: 500 })
  }
}
