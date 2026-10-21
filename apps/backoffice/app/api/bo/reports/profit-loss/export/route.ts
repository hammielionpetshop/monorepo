import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import Big from 'big.js'
import { verifyAccessToken } from '@/lib/auth'
import { getProfitLossReport } from '@/lib/services/report-service'

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  format: z.literal('csv').optional(),
})

export const dynamic = 'force-dynamic'

function formatAmount(value: string): string {
  // Gunakan big.js untuk pembulatan sebelum konversi ke number untuk Intl.NumberFormat
  const rounded = new Big(value).toFixed(0)
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(rounded))
}

function formatMargin(revenue: string, grossProfit: string): string {
  try {
    const rev = new Big(revenue)
    if (rev.eq(0)) return ''
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
      new Big(grossProfit).div(rev).times(100).toNumber(),
    )
  } catch {
    return ''
  }
}

function escapeCsvCell(value: string): string {
  // Bersihkan karakter baris baru agar tidak merusak struktur CSV
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

    const { startDate, endDate } = parsed.data

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai' },
        { status: 400 }
      )
    }

    const data = await getProfitLossReport({ startDate, endDate })

    const rows = [
      [
        'Cabang',
        'Pendapatan Bersih Retur (IDR)',
        'HPP Bersih Retur (IDR)',
        'Laba Kotor (IDR)',
        'Kerugian Barang Rusak (IDR)',
        'Laba Bersih (IDR)',
        'Jumlah Transaksi',
        // Dua kolom terakhir informatif — tidak mempengaruhi laba di kolom sebelumnya
        'Penjualan Hutang (IDR)',
        'Pelunasan Piutang Diterima (IDR)',
        // Sudah dikurangkan dari Pendapatan & HPP di atas
        'Retur (IDR)',
        'HPP Retur (IDR)',
        // Revisi Harga Beli kiriman internal: koreksi omzet sudah dikurangkan dari Pendapatan;
        // Penyesuaian Modal sudah masuk Laba Bersih (positif = menambah laba)
        'Koreksi Omzet Revisi Harga Beli (IDR)',
        'Penyesuaian Modal Revisi Harga Beli (IDR)',
      ],
      ...data.items.map((item) => [
        item.branchName,
        formatAmount(item.revenue),
        formatAmount(item.cogs),
        formatAmount(item.grossProfit),
        formatAmount(item.damagedLoss),
        formatAmount(item.netProfit),
        item.transactionCount.toString(),
        formatAmount(item.debtSales),
        formatAmount(item.debtCollected),
        formatAmount(item.returnAmount),
        formatAmount(item.returnCogs),
        formatAmount(item.priceRevisionRevenue),
        formatAmount(item.costAdjustment),
      ]),
      [
        'TOTAL',
        formatAmount(data.totalRevenue),
        formatAmount(data.totalCogs),
        formatAmount(data.totalGrossProfit),
        formatAmount(data.totalDamagedLoss),
        formatAmount(data.totalNetProfit),
        data.totalTransactionCount.toString(),
        formatAmount(data.totalDebtSales),
        formatAmount(data.totalDebtCollected),
        formatAmount(data.totalReturnAmount),
        formatAmount(data.totalReturnCogs),
        formatAmount(data.totalPriceRevisionRevenue),
        formatAmount(data.totalCostAdjustment),
      ],
      // Blok rincian per cabang × kelas harga (basis baris nota, sudah bersih retur) — lihat tierScopes.
      [],
      ['Cabang', 'Kelas Harga', 'Omzet (IDR)', 'HPP (IDR)', 'Laba Kotor (IDR)', 'Margin Kotor (%)', 'Jumlah Transaksi', 'Nilai Retur (IDR)'],
      ...data.tierScopes.flatMap((scope) => [
        ...scope.tiers.map((tier) => [
          scope.branchName,
          tier.tierLabel,
          formatAmount(tier.revenue),
          formatAmount(tier.cogs),
          formatAmount(tier.grossProfit),
          formatMargin(tier.revenue, tier.grossProfit),
          tier.transactionCount.toString(),
          formatAmount(tier.returnRevenue),
        ]),
        [
          `${scope.branchName} — TOTAL`,
          '',
          formatAmount(scope.totalRevenue),
          formatAmount(scope.totalCogs),
          formatAmount(scope.totalGrossProfit),
          formatMargin(scope.totalRevenue, scope.totalGrossProfit),
          '',
          '',
        ],
      ]),
    ]

    const csv = rows.map((row) => row.map((cell) => `"${escapeCsvCell(cell)}"`).join(',')).join('\r\n')
    const filename = `laporan-laba-rugi-${startDate}-${endDate}.csv`

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
