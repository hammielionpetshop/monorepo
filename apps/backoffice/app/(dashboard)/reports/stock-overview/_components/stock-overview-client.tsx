'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import type { StockOverviewItem, StockOverviewDetail } from './types'

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value))
  } catch {
    return 'Rp 0'
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function StockOverviewClient({ items }: { items: StockOverviewItem[] }) {
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)
  const [detailCache, setDetailCache] = useState<Record<number, StockOverviewDetail | 'loading' | 'error'>>({})
  const [expandedBranchId, setExpandedBranchId] = useState<number | null>(null)

  async function toggleProduct(productId: number) {
    if (expandedProductId === productId) {
      setExpandedProductId(null)
      return
    }
    setExpandedProductId(productId)
    setExpandedBranchId(null)
    if (detailCache[productId]) return

    setDetailCache((prev) => ({ ...prev, [productId]: 'loading' }))
    try {
      const res = await fetch(`/api/bo/reports/stock-overview/${productId}`)
      if (!res.ok) throw new Error('Gagal memuat detail')
      const data: StockOverviewDetail = await res.json()
      setDetailCache((prev) => ({ ...prev, [productId]: data }))
    } catch {
      setDetailCache((prev) => ({ ...prev, [productId]: 'error' }))
    }
  }

  if (items.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-muted-foreground text-sm">
        Tidak ada produk dengan stok tersedia saat ini
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 text-muted-foreground border-b border-border">
            <th className="w-10 px-4 py-4"></th>
            <th className="text-left px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Nama Produk</th>
            <th className="text-left px-4 py-4 font-bold uppercase tracking-widest text-[10px]">SKU</th>
            <th className="text-left px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Kategori</th>
            <th className="text-right px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Total Stok</th>
            <th className="text-right px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Nilai Stok (FIFO)</th>
            <th className="text-right px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Utang Stok</th>
            <th className="text-center px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
            <th className="text-center px-4 py-4 font-bold uppercase tracking-widest text-[10px]">Batch</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => {
            const isExpanded = expandedProductId === item.productId
            const detail = detailCache[item.productId]
            const hasShortfall = Number(item.shortfallQty) > 0

            return (
              <>
                <tr
                  key={item.productId}
                  onClick={() => toggleProduct(item.productId)}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-4 text-muted-foreground">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="px-4 py-4 font-semibold text-card-foreground">{item.productName}</td>
                  <td className="px-4 py-4 text-muted-foreground font-mono text-xs">{item.sku ?? '-'}</td>
                  <td className="px-4 py-4 text-muted-foreground">{item.categoryName ?? '-'}</td>
                  <td className="px-4 py-4 text-right font-medium text-card-foreground">
                    {item.stockDisplay}
                    <span className="block text-[11px] text-muted-foreground font-normal">({item.totalQty})</span>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(item.totalValue)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {hasShortfall ? (
                      <span className="font-bold text-destructive">{formatRupiah(item.shortfallValue)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center text-card-foreground">{item.branchCount}</td>
                  <td className="px-4 py-4 text-center text-card-foreground">{item.batchCount}</td>
                </tr>

                {isExpanded && (
                  <tr key={`${item.productId}-detail`}>
                    <td colSpan={9} className="bg-muted/10 px-4 py-4">
                      {detail === 'loading' && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                          <Loader2 className="h-4 w-4 animate-spin" /> Memuat detail batch...
                        </div>
                      )}
                      {detail === 'error' && (
                        <div className="text-destructive text-sm py-4">Gagal memuat detail batch. Coba lagi.</div>
                      )}
                      {detail && detail !== 'loading' && detail !== 'error' && (
                        <div className="flex flex-col gap-2">
                          {detail.branches.length === 0 && (
                            <div className="text-muted-foreground text-sm py-2">Tidak ada baris cabang untuk produk ini.</div>
                          )}
                          {detail.branches.map((branch) => {
                            const branchExpanded = expandedBranchId === branch.branchId
                            return (
                              <div key={branch.branchId} className="rounded-md border border-border bg-card">
                                <div
                                  onClick={() => setExpandedBranchId(branchExpanded ? null : branch.branchId)}
                                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {branchExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    <span className="font-semibold text-card-foreground">{branch.branchName}</span>
                                    <span className="text-xs text-muted-foreground">{branch.batchCount} batch</span>
                                  </div>
                                  <div className="flex items-center gap-6 text-sm">
                                    <span className="text-card-foreground">{branch.totalQty} unit</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(branch.totalValue)}</span>
                                    {Number(branch.shortfallQty) > 0 && (
                                      <span className="font-bold text-destructive">Utang: {formatRupiah(branch.shortfallValue)}</span>
                                    )}
                                  </div>
                                </div>
                                {branchExpanded && (
                                  <div className="border-t border-border overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-muted/20 text-muted-foreground">
                                          <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">Kode Batch</th>
                                          <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">PO</th>
                                          <th className="text-right px-4 py-2 font-bold uppercase tracking-widest">Diterima</th>
                                          <th className="text-right px-4 py-2 font-bold uppercase tracking-widest">Sisa</th>
                                          <th className="text-right px-4 py-2 font-bold uppercase tracking-widest">Modal/Unit</th>
                                          <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">Tgl Masuk</th>
                                          <th className="text-left px-4 py-2 font-bold uppercase tracking-widest">Kedaluwarsa</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border">
                                        {branch.batches.map((batch) => (
                                          <tr key={batch.id}>
                                            <td className="px-4 py-2 font-mono text-card-foreground">{batch.displayCode}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{batch.poNumber ?? '-'}</td>
                                            <td className="px-4 py-2 text-right text-card-foreground">{batch.qtyReceived}</td>
                                            <td className="px-4 py-2 text-right text-card-foreground">{batch.qtyRemaining}</td>
                                            <td className="px-4 py-2 text-right text-card-foreground">{formatRupiah(batch.costPrice)}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{formatDate(batch.receivedAt)}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{batch.expiryDate ? formatDate(batch.expiryDate) : '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
