'use client'

import Big from 'big.js'
import { ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'
import {
  formatPriceRange,
  hasMeaningfulUomBreakdown,
  type SalesByProductItem,
} from '@/lib/services/sales-by-product-uom'

const COLUMN_COUNT = 9

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

/** Harga per satuan boleh pecahan — membulatkannya ke rupiah bulat menyembunyikan efek diskon. */
function formatPrice(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(new Big(value).toNumber())
  } catch {
    return 'Rp 0'
  }
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}

function productKey(item: SalesByProductItem): string {
  return item.productId == null ? `nama:${item.productName}` : `id:${item.productId}`
}

export default function SalesTableClient({
  items,
  totalRevenue,
  totalCogs,
  totalGrossProfit,
}: {
  items: SalesByProductItem[]
  totalRevenue: string
  totalCogs: string
  totalGrossProfit: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="bg-muted text-muted-foreground border-b border-border">
          <th className="text-left px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Produk</th>
          <th className="text-left px-3 py-3 font-bold uppercase tracking-widest text-[10px]">Satuan</th>
          <th className="text-right px-3 py-3 font-bold uppercase tracking-widest text-[10px]">Qty Terjual</th>
          <th className="text-right px-3 py-3 font-bold uppercase tracking-widest text-[10px]">Harga Realisasi</th>
          <th className="text-right px-3 py-3 font-bold uppercase tracking-widest text-[10px]">Harga Master</th>
          <th className="text-right px-3 py-3 font-bold uppercase tracking-widest text-[10px]">Jml Transaksi</th>
          <th className="text-right px-3 py-3 font-bold uppercase tracking-widest text-[10px]">Pendapatan</th>
          <th className="text-right px-3 py-3 font-bold uppercase tracking-widest text-[10px]">HPP</th>
          <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Laba Kotor</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {items.length === 0 ? (
          <tr>
            <td colSpan={COLUMN_COUNT} className="px-6 py-10 text-center text-muted-foreground">
              Tidak ada penjualan pada periode ini.
            </td>
          </tr>
        ) : (
          items.map((item) => {
            const key = productKey(item)
            const isOpen = expanded.has(key)
            const canExpand = hasMeaningfulUomBreakdown(item)

            return (
              <Fragment key={key}>
                <tr className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-3 font-semibold text-card-foreground">
                    {canExpand ? (
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        className="flex items-start gap-1.5 text-left hover:text-primary transition-colors"
                      >
                        <ChevronRight
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                        <span>
                          {item.productName}
                          {item.sku && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{item.sku}</span>
                          )}
                        </span>
                      </button>
                    ) : (
                      <span className="flex items-start gap-1.5">
                        <span className="h-4 w-4 flex-shrink-0" />
                        <span>
                          {item.productName}
                          {item.sku && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{item.sku}</span>
                          )}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{item.baseUomCode ?? '—'}</td>
                  <td className="px-3 py-3 text-right text-card-foreground">{formatQty(item.qtyBase)}</td>
                  <td className="px-3 py-3 text-right text-card-foreground">{formatPrice(item.realizedPricePerBase)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">
                    {formatPriceRange(item.masterPricePerBaseMin, item.masterPricePerBaseMax, formatPrice)}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{item.transactionCount}</td>
                  <td className="px-3 py-3 text-right font-medium text-card-foreground">{formatRupiah(item.revenue)}</td>
                  <td className="px-3 py-3 text-right text-muted-foreground">{formatRupiah(item.cogs)}</td>
                  <td className="px-6 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(item.grossProfit)}
                  </td>
                </tr>

                {isOpen &&
                  item.uoms.map((uom) => (
                    <tr key={`${key}-uom-${uom.uomId ?? uom.uomCode}`} className="bg-muted/20 text-xs">
                      <td className="pl-14 pr-6 py-2 text-muted-foreground">
                        per {uom.uomCode}
                        {uom.ratioToBase !== 1 && item.baseUomCode && (
                          <span className="ml-1.5 text-[11px]">
                            (1 {uom.uomCode} = {formatQty(uom.ratioToBase)} {item.baseUomCode})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{uom.uomCode}</td>
                      <td className="px-3 py-2 text-right text-card-foreground">{formatQty(uom.qty)}</td>
                      <td className="px-3 py-2 text-right text-card-foreground">{formatPrice(uom.realizedPrice)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {formatPriceRange(uom.masterPriceMin, uom.masterPriceMax, formatPrice)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{uom.transactionCount}</td>
                      <td className="px-3 py-2 text-right text-card-foreground">{formatRupiah(uom.revenue)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{formatRupiah(uom.cogs)}</td>
                      <td className="px-6 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(uom.grossProfit)}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            )
          })
        )}
      </tbody>
      <tfoot className="sticky bottom-0 z-10">
        <tr className="border-t-2 border-border bg-muted">
          <td className="px-6 py-3 font-bold text-card-foreground">TOTAL</td>
          <td className="px-3 py-3"></td>
          {/* Qty sengaja dikosongkan: menjumlahkan satuan dasar lintas produk (kg + pcs) tidak bermakna. */}
          <td className="px-3 py-3 text-right text-muted-foreground">—</td>
          <td className="px-3 py-3"></td>
          <td className="px-3 py-3"></td>
          <td className="px-3 py-3"></td>
          <td className="px-3 py-3 text-right font-bold text-card-foreground">{formatRupiah(totalRevenue)}</td>
          <td className="px-3 py-3 text-right font-bold text-card-foreground">{formatRupiah(totalCogs)}</td>
          <td className="px-6 py-3 text-right font-bold text-primary">{formatRupiah(totalGrossProfit)}</td>
        </tr>
      </tfoot>
    </table>
  )
}
