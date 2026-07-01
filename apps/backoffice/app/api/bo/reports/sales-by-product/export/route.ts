import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import Big from 'big.js'
import { verifyAccessToken } from '@/lib/auth'
import { getSalesByProductReport } from '@/lib/services/report-service'

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  productId: z.string().regex(/^\d+$/).optional(),
  branchId: z.string().regex(/^\d+$/).optional(),
  format: z.literal('csv').optional(),
})

export const dynamic = 'force-dynamic'

function formatAmount(value: string): string {
  const rounded = new Big(value).toFixed(0)
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(rounded))
}

function escapeCsvCell(value: string): string {
  let escaped = value.replace(/[\n\r]/g, ' ').replace(/"/g, '""')
  if (/^[=+\-@]/.test(escaped)) {
    escaped = `'${escaped}`
  }
  return escaped
}

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams))

    if (!parsed.success) {
      return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
    }

    const { startDate, endDate, productId, branchId } = parsed.data

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' },
        { status: 400 }
      )
    }

    const data = await getSalesByProductReport({
      startDate,
      endDate,
      productId: productId ? Number(productId) : null,
      branchId: branchId ? Number(branchId) : null,
    })

    const rows = [
      ['Produk', 'SKU', 'Qty Terjual', 'Jumlah Transaksi', 'Pendapatan (IDR)', 'HPP (IDR)', 'Laba Kotor (IDR)'],
      ...data.items.map((item) => [
        item.productName,
        item.sku ?? '',
        item.qtySold.toString(),
        item.transactionCount.toString(),
        formatAmount(item.revenue),
        formatAmount(item.cogs),
        formatAmount(item.grossProfit),
      ]),
      [
        'TOTAL',
        '',
        data.totalQty.toString(),
        '',
        formatAmount(data.totalRevenue),
        formatAmount(data.totalCogs),
        formatAmount(data.totalGrossProfit),
      ],
    ]

    const csv = rows.map((row) => row.map((cell) => `"${escapeCsvCell(cell)}"`).join(',')).join('\r\n')
    const filename = `laporan-penjualan-produk-${startDate}-${endDate}.csv`

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
