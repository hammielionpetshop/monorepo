import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/authz'
import { getStockOpnameDetail } from '@/lib/services/stock-opname-report'
import { CATEGORY_LABELS } from '@/lib/stock-opname-labels'

export const dynamic = 'force-dynamic'

function escapeCsvCell(val: string): string {
  const sanitized =
    val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')
      ? `'${val}`
      : val
  return `"${sanitized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('stock_opname.read')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id } = await params
    const soId = Number(id)
    if (!Number.isInteger(soId) || soId <= 0) {
      return NextResponse.json({ error: 'ID stock opname tidak valid' }, { status: 400 })
    }

    const detail = await getStockOpnameDetail(soId)
    if (!detail) {
      return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
    }

    if (payload.branchScope !== 'ALL' && detail.header.branchId !== payload.branchId) {
      return NextResponse.json(
        { error: 'Anda hanya dapat mengekspor stock opname cabang sendiri' },
        { status: 403 }
      )
    }

    const isApproved = detail.header.status === 'APPROVED'
    const mismatchItems = detail.items.filter((item) => item.varianceQty !== 0)

    const rows: (string | number)[][] = [
      ['nama produk', 'sku', 'satuan', 'qty system', 'real stock', 'selisih', 'nilai selisih', 'kategori', 'alasan'],
      ...mismatchItems.map((item) => [
        item.productName,
        item.sku ?? '',
        item.uomCode,
        item.systemQty,
        item.physicalQty,
        item.varianceQty,
        isApproved ? item.varianceCostValue ?? 0 : '',
        item.varianceCategory ? CATEGORY_LABELS[item.varianceCategory] ?? item.varianceCategory : '',
        item.varianceReason ?? '',
      ]),
    ]

    const csv = rows.map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(',')).join('\r\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${detail.header.soNumber}-tidak-match.csv"`,
      },
    })
  } catch (error: unknown) {
    console.error('Export SO Detail API error:', error)
    return NextResponse.json({ error: 'Gagal mengekspor detail stock opname' }, { status: 500 })
  }
}
