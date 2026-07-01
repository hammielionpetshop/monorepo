import Big from 'big.js'
import { db, products, branches, eq, asc } from '@/lib/db'
import {
  getSalesByProductReport,
  getProductStockValue,
  getTransactionsWithProduct,
  type SalesByProductData,
  type ProductStockValueData,
  type ProductTransactionRow,
} from '@/lib/services/report-service'
import type { ProductOption } from '@/components/ui/product-select'
import FilterClient, { type BranchOption } from './_components/filter-client'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(new Big(value).toNumber())
  } catch {
    return 'Rp 0'
  }
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}

export default async function SalesByProductPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; productId?: string; branchId?: string }>
}) {
  const params = await searchParams
  const { startDate, endDate, productId, branchId } = params

  const [productRows, branchRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.name)),
    db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(asc(branches.name)),
  ])

  const productOptions: ProductOption[] = productRows
  const branchOptions: BranchOption[] = branchRows

  let reportData: SalesByProductData | null = null
  let stockValue: ProductStockValueData | null = null
  let productTransactions: ProductTransactionRow[] = []
  let error: string | null = null

  if (startDate && endDate) {
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      error = 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.'
    } else if (startDate > endDate) {
      error = 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.'
    } else {
      try {
        const pid = productId && /^\d+$/.test(productId) ? Number(productId) : null
        const bid = branchId && /^\d+$/.test(branchId) ? Number(branchId) : null
        reportData = await getSalesByProductReport({ startDate, endDate, productId: pid, branchId: bid })
        if (pid != null) {
          ;[stockValue, productTransactions] = await Promise.all([
            getProductStockValue({ productId: pid, branchId: bid }),
            getTransactionsWithProduct({ startDate, endDate, productId: pid, branchId: bid }),
          ])
        }
      } catch {
        error = 'Gagal mengambil data laporan. Silakan coba lagi.'
      }
    }
  }

  const exportQuery = reportData
    ? `startDate=${startDate}&endDate=${endDate}${reportData.productId ? `&productId=${reportData.productId}` : ''}${reportData.branchId ? `&branchId=${reportData.branchId}` : ''}&format=csv`
    : ''

  const selectedProductName =
    reportData?.productId != null
      ? productOptions.find((p) => p.id === reportData?.productId)?.name ?? 'Produk terpilih'
      : null

  const productSelected = reportData?.productId != null

  return (
    <div className="h-full flex flex-col gap-4 p-6 max-w-7xl mx-auto min-h-0">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Laporan Penjualan per Produk</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rincian penjualan, HPP, dan laba kotor per produk pada periode pilihan
        </p>
      </div>

      <div className="flex-shrink-0">
        <FilterClient
          products={productOptions}
          branches={branchOptions}
          defaultStartDate={startDate}
          defaultEndDate={endDate}
          defaultProductId={productId}
          defaultBranchId={branchId}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="flex-shrink-0 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Area Hasil — mengisi sisa tinggi layar */}
      {reportData && (
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Card Nilai Stok Produk Terpilih */}
          {stockValue && (
            <div className="flex-shrink-0 bg-card rounded-lg border border-border p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Nilai Stok Saat Ini
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-card-foreground">{selectedProductName}</p>
                  <p className="mt-1 text-xl font-bold text-primary">{formatRupiah(stockValue.totalValue)}</p>
                  <p className="text-xs text-muted-foreground">
                    Sisa stok: {formatQty(new Big(stockValue.totalQty).toNumber())}
                  </p>
                </div>
                {stockValue.branches.length > 1 && (
                  <div className="text-xs text-muted-foreground">
                    <table className="text-right">
                      <tbody>
                        {stockValue.branches.map((b) => (
                          <tr key={b.branchId}>
                            <td className="pr-4 text-left py-0.5 text-card-foreground">{b.branchName}</td>
                            <td className="py-0.5">{formatQty(new Big(b.totalQty).toNumber())}</td>
                            <td className="pl-4 py-0.5 font-medium text-card-foreground">{formatRupiah(b.totalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabel Laporan — mengisi sisa tinggi bila tanpa filter produk, ringkas bila produk dipilih */}
          <div
            className={`bg-card rounded-lg border border-border shadow-xs flex flex-col overflow-hidden ${
              productSelected ? 'flex-shrink-0' : 'flex-1 min-h-0'
            }`}
          >
            <div className="flex-shrink-0 px-6 py-3 border-b border-border flex items-center justify-between bg-muted/20">
              <h2 className="text-sm font-bold text-card-foreground">
                Hasil Laporan: {startDate} s/d {endDate}
              </h2>
              <a
                href={`/api/bo/reports/sales-by-product/export?${exportQuery}`}
                className="px-3 py-1.5 text-xs font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
              >
                Export CSV
              </a>
            </div>
            <div className={`overflow-auto ${productSelected ? '' : 'flex-1 min-h-0'}`}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted text-muted-foreground border-b border-border">
                    <th className="text-left px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Produk</th>
                    <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Qty Terjual</th>
                    <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Jml Transaksi</th>
                    <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Pendapatan</th>
                    <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">HPP</th>
                    <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Laba Kotor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                        Tidak ada penjualan pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    reportData.items.map((item) => (
                      <tr key={item.productId ?? item.productName} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-3 font-semibold text-card-foreground">
                          {item.productName}
                          {item.sku && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{item.sku}</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right text-card-foreground">{formatQty(item.qtySold)}</td>
                        <td className="px-6 py-3 text-right text-muted-foreground">{item.transactionCount}</td>
                        <td className="px-6 py-3 text-right font-medium text-card-foreground">{formatRupiah(item.revenue)}</td>
                        <td className="px-6 py-3 text-right text-muted-foreground">{formatRupiah(item.cogs)}</td>
                        <td className="px-6 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(item.grossProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="border-t-2 border-border bg-muted">
                    <td className="px-6 py-3 font-bold text-card-foreground">TOTAL</td>
                    <td className="px-6 py-3 text-right font-bold text-card-foreground">{formatQty(reportData.totalQty)}</td>
                    <td className="px-6 py-3"></td>
                    <td className="px-6 py-3 text-right font-bold text-card-foreground">
                      {formatRupiah(reportData.totalRevenue)}
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-card-foreground">
                      {formatRupiah(reportData.totalCogs)}
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-primary">
                      {formatRupiah(reportData.totalGrossProfit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Daftar Transaksi yang Memuat Produk Terpilih — scroll mandiri */}
          {productSelected && (
            <div className="flex-1 min-h-0 bg-card rounded-lg border border-border shadow-xs flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-6 py-3 border-b border-border bg-muted/20">
                <h2 className="text-sm font-bold text-card-foreground">
                  Transaksi yang Memuat Produk Ini
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedProductName} · {productTransactions.length} transaksi
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-muted text-muted-foreground border-b border-border">
                      <th className="text-left px-6 py-3 font-bold uppercase tracking-widest text-[10px]">No. Transaksi</th>
                      <th className="text-left px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Tanggal</th>
                      <th className="text-left px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Toko</th>
                      <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Qty</th>
                      <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Subtotal Produk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                          Tidak ada transaksi yang memuat produk ini pada periode & toko terpilih.
                        </td>
                      </tr>
                    ) : (
                      productTransactions.map((trx) => (
                        <tr key={trx.transactionId} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3 font-semibold text-card-foreground">{trx.trxNumber}</td>
                          <td className="px-6 py-3 text-muted-foreground">{formatDateTime(trx.createdAt)}</td>
                          <td className="px-6 py-3 text-muted-foreground">{trx.branchName}</td>
                          <td className="px-6 py-3 text-right text-card-foreground">{formatQty(trx.qty)}</td>
                          <td className="px-6 py-3 text-right font-medium text-card-foreground">{formatRupiah(trx.revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
