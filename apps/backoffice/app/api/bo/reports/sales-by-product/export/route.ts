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
  customerId: z.string().regex(/^\d+$/).optional(),
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

/** Harga per satuan boleh pecahan — dibulatkan 2 desimal, bukan ke rupiah bulat. */
function formatPrice(value: string): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(new Big(value).toNumber())
}

function formatMasterPrice(min: string | null, max: string | null): string {
  if (min == null || max == null) return ''
  if (new Big(min).eq(new Big(max))) return formatPrice(min)
  return `${formatPrice(min)} - ${formatPrice(max)}`
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

    const { startDate, endDate, productId, branchId, customerId } = parsed.data

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
      customerId: customerId ? Number(customerId) : null,
    })

    // Dua tingkat baris: 'Total produk' (sudah disetarakan ke satuan dasar) diikuti
    // baris 'Per satuan' apa adanya. Kolom Qty hanya boleh dijumlahkan pada baris satuan dasar.
    const rows = [
      [
        'Produk',
        'SKU',
        'Tingkat',
        'Satuan',
        'Isi per Satuan (dalam satuan dasar)',
        'Qty Terjual',
        'Qty dalam Satuan Dasar',
        'Harga Realisasi per Satuan (IDR)',
        'Harga Master per Satuan (IDR)',
        'Jumlah Transaksi',
        'Pendapatan (IDR)',
        'HPP (IDR)',
        'Laba Kotor (IDR)',
      ],
      ...data.items.flatMap((item) => [
        [
          item.productName,
          item.sku ?? '',
          'Total produk',
          item.baseUomCode ?? '',
          '1',
          item.qtyBase.toString(),
          item.qtyBase.toString(),
          formatPrice(item.realizedPricePerBase),
          formatMasterPrice(item.masterPricePerBaseMin, item.masterPricePerBaseMax),
          item.transactionCount.toString(),
          formatAmount(item.revenue),
          formatAmount(item.cogs),
          formatAmount(item.grossProfit),
        ],
        ...item.uoms.map((uom) => [
          item.productName,
          item.sku ?? '',
          'Per satuan',
          uom.uomCode,
          uom.ratioToBase.toString(),
          uom.qty.toString(),
          uom.qtyBase.toString(),
          formatPrice(uom.realizedPrice),
          formatMasterPrice(uom.masterPriceMin, uom.masterPriceMax),
          uom.transactionCount.toString(),
          formatAmount(uom.revenue),
          formatAmount(uom.cogs),
          formatAmount(uom.grossProfit),
        ]),
      ]),
      [
        'TOTAL',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
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
