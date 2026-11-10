import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { getOpenPriceReviews } from '@/lib/services/price-review-service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const gate = await requirePermission('master.price.manage')
  if (gate instanceof NextResponse) return gate

  const branchParam = new URL(req.url).searchParams.get('branchId')
  const branchId = branchParam && /^\d+$/.test(branchParam) ? Number(branchParam) : null

  try {
    return NextResponse.json(await getOpenPriceReviews({ branchId }))
  } catch (error: unknown) {
    console.error('GET /api/bo/price-reviews error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar pemeriksaan harga jual' }, { status: 500 })
  }
}
