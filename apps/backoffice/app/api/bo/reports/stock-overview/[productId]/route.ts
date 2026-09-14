import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { getStockOverviewDetail } from '@/lib/services/report-service'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const gate = await requirePermission('report.stock_overview.view')
  if (gate instanceof NextResponse) return gate

  const { productId } = await params
  if (!/^\d+$/.test(productId)) {
    return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
  }

  try {
    const scopeBranchId = gate.branchScope === 'ALL' ? null : gate.branchId
    const detail = await getStockOverviewDetail(Number(productId), scopeBranchId)

    if (!detail) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error: unknown) {
    console.error('GET /api/bo/reports/stock-overview/[productId] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil detail batch' }, { status: 500 })
  }
}
