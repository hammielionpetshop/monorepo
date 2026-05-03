import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getStockValuationReport } from '@/lib/services/report-service'

export const dynamic = 'force-dynamic'

function escapeCsvCell(val: string): string {
  const sanitized =
    val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')
      ? `'${val}`
      : val
  return `"${sanitized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const data = await getStockValuationReport()
    const today = new Date().toLocaleDateString('en-CA')

    const rows = [
      ['Nama Produk', 'SKU', 'Cabang', 'Stok (Base UOM)', 'Nilai FIFO (IDR)'],
      ...data.items.map((item) => [
        item.productName,
        item.sku ?? '',
        item.branchName,
        item.totalQty,
        item.totalValue,
      ]),
      ['TOTAL', '', '', '', data.totalValue],
    ]

    const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
    const filename = `laporan-nilai-stok-${today}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengekspor laporan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
