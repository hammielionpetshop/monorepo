'use client'

import Big from 'big.js'
import { ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import {
  formatPriceRange,
  hasMeaningfulUomBreakdown,
  type SalesByProductItem,
} from '@/lib/services/sales-by-product-uom'

const COLUMN_COUNT = 9

type SortKey =
  | 'productName'
  | 'baseUomCode'
  | 'qtyBase'
  | 'realizedPricePerBase'
  | 'masterPricePerBase'
  | 'transactionCount'
  | 'revenue'
  | 'cogs'
  | 'grossProfit'

type SortDir = 'asc' | 'desc'

interface ColumnSpec {
  key: SortKey
  label: string
  align: 'left' | 'right'
  /** Kolom teks mulai dari A→Z, kolom angka mulai dari terbesar — itu yang biasanya dicari. */
  numeric: boolean
  className: string
}

const COLUMNS: ColumnSpec[] = [
  { key: 'productName', label: 'Produk', align: 'left', numeric: false, className: 'px-6' },
  { key: 'baseUomCode', label: 'Satuan', align: 'left', numeric: false, className: 'px-3' },
  { key: 'qtyBase', label: 'Qty Terjual', align: 'right', numeric: true, className: 'px-3' },
  { key: 'realizedPricePerBase', label: 'Harga Realisasi', align: 'right', numeric: true, className: 'px-3' },
  { key: 'masterPricePerBase', label: 'Harga Master', align: 'right', numeric: true, className: 'px-3' },
  { key: 'transactionCount', label: 'Jml Transaksi', align: 'right', numeric: true, className: 'px-3' },
  { key: 'revenue', label: 'Pendapatan', align: 'right', numeric: true, className: 'px-3' },
  { key: 'cogs', label: 'HPP', align: 'right', numeric: true, className: 'px-3' },
  { key: 'grossProfit', label: 'Laba Kotor', align: 'right', numeric: true, className: 'px-6' },
]

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

function toNumber(value: string | null): number | null {
  if (value == null) return null
  try {
    return new Big(value).toNumber()
  } catch {
    return null
  }
}

/** Nilai angka untuk pengurutan; null berarti sel kosong dan selalu ditaruh paling akhir. */
function numericValue(item: SalesByProductItem, key: SortKey): number | null {
  switch (key) {
    case 'qtyBase':
      return item.qtyBase
    case 'transactionCount':
      return item.transactionCount
    case 'realizedPricePerBase':
      return toNumber(item.realizedPricePerBase)
    case 'masterPricePerBase':
      return toNumber(item.masterPricePerBaseMin) ?? toNumber(item.masterPricePerBaseMax)
    case 'revenue':
      return toNumber(item.revenue)
    case 'cogs':
      return toNumber(item.cogs)
    case 'grossProfit':
      return toNumber(item.grossProfit)
    default:
      return null
  }
}

function textValue(item: SalesByProductItem, key: SortKey): string {
  if (key === 'baseUomCode') return item.baseUomCode ?? ''
  return item.productName
}

function compareItems(a: SalesByProductItem, b: SalesByProductItem, key: SortKey, numeric: boolean): number {
  if (!numeric) {
    const av = textValue(a, key)
    const bv = textValue(b, key)
    if (av === bv) return 0
    if (av === '') return 1
    if (bv === '') return -1
    return av.localeCompare(bv, 'id-ID', { sensitivity: 'base', numeric: true })
  }

  const av = numericValue(a, key)
  const bv = numericValue(b, key)
  if (av == null && bv == null) return 0
  if (av == null) return 1
  if (bv == null) return -1
  return av - bv
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
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null)

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /** Klik ketiga mengembalikan urutan bawaan dari server, supaya urutan itu tetap bisa diraih. */
  function toggleSort(column: ColumnSpec) {
    const firstDir: SortDir = column.numeric ? 'desc' : 'asc'
    setSort((prev) => {
      if (prev?.key !== column.key) return { key: column.key, dir: firstDir }
      if (prev.dir === firstDir) return { key: column.key, dir: firstDir === 'asc' ? 'desc' : 'asc' }
      return null
    })
  }

  const sortedItems = useMemo(() => {
    if (!sort) return items
    const column = COLUMNS.find((c) => c.key === sort.key)
    if (!column) return items
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      const cmp = compareItems(a, b, sort.key, column.numeric)
      if (cmp !== 0) return cmp * factor
      return a.productName.localeCompare(b.productName, 'id-ID', { sensitivity: 'base' })
    })
  }, [items, sort])

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="bg-muted text-muted-foreground border-b border-border">
          {COLUMNS.map((column) => {
            const active = sort?.key === column.key
            const SortIcon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown
            return (
              <th
                key={column.key}
                aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                className={`${column.align === 'right' ? 'text-right' : 'text-left'} ${column.className} py-3 font-bold uppercase tracking-widest text-[10px]`}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(column)}
                  title={`Urutkan berdasarkan ${column.label}`}
                  className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                    column.align === 'right' ? 'flex-row-reverse' : ''
                  } ${active ? 'text-foreground' : ''}`}
                >
                  <span>{column.label}</span>
                  <SortIcon className={`h-3 w-3 flex-shrink-0 ${active ? 'opacity-100' : 'opacity-40'}`} />
                </button>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {sortedItems.length === 0 ? (
          <tr>
            <td colSpan={COLUMN_COUNT} className="px-6 py-10 text-center text-muted-foreground">
              Tidak ada penjualan pada periode ini.
            </td>
          </tr>
        ) : (
          sortedItems.map((item) => {
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
