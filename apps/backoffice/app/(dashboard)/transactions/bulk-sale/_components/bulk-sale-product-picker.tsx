'use client'

import { useEffect, useRef } from 'react'
import { orderedUomCandidates, pricesForUom } from './bulk-sale-pricing'
import type { BulkSaleProduct } from './types'

type BulkSaleProductPickerProps = {
  query: string
  onQueryChange: (query: string) => void
  results: BulkSaleProduct[]
  isSearching: boolean
  highlightIndex: number
  onHighlightChange: (index: number) => void
  onPick: (product: BulkSaleProduct) => void
  onClose: () => void
}

function formatNumber(value: number) {
  return value.toLocaleString('id-ID')
}

function highlightWords(name: string, query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return name
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = name.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-700/60">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

// Stok dalam satuan dasar ditambah padanannya di satuan terbesar (≈ 2 DUS) supaya
// orang gudang tidak perlu membagi rasio di kepala.
function describeStock(product: BulkSaleProduct) {
  const base = `${formatNumber(product.stock)} ${product.baseUomCode}`
  const largest = orderedUomCandidates(product).find((uom) => uom.conversionRate > 1)
  if (!largest || product.stock <= 0) return { base, converted: null }
  const converted = Math.floor(product.stock / largest.conversionRate)
  return { base, converted: converted > 0 ? `≈ ${formatNumber(converted)} ${largest.uomCode}` : null }
}

export default function BulkSaleProductPicker({
  query,
  onQueryChange,
  results,
  isSearching,
  highlightIndex,
  onHighlightChange,
  onPick,
  onClose,
}: BulkSaleProductPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }, [])

  useEffect(() => {
    rowRefs.current[highlightIndex]?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onHighlightChange(Math.min(highlightIndex + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      onHighlightChange(Math.max(highlightIndex - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const product = results[highlightIndex]
      if (product) onPick(product)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Pilih produk"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border p-3">
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik sebagian nama produk, boleh beberapa kata (mis. royal kitten)..."
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Mencari...</span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            ↑ ↓ pilih baris · Enter masukkan ke daftar · Esc tutup
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {!query.trim() ? 'Mulai ketik nama produk.' : isSearching ? 'Mencari...' : 'Produk tidak ditemukan'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nama Produk</th>
                  <th className="w-[55%] px-3 py-2 text-left text-xs font-medium text-muted-foreground">Jenjang Harga</th>
                  <th className="w-32 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Stok</th>
                </tr>
              </thead>
              <tbody>
                {results.map((product, index) => {
                  const isHighlighted = index === highlightIndex
                  const stock = describeStock(product)
                  const priceGroups = orderedUomCandidates(product)
                    .map((uom) => ({ uom, prices: pricesForUom(product.prices, uom.uomId) }))
                    .filter((group) => group.prices.length > 0)
                  return (
                    <tr
                      key={product.id}
                      ref={(element) => {
                        rowRefs.current[index] = element
                      }}
                      onMouseEnter={() => onHighlightChange(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        onPick(product)
                      }}
                      className={`cursor-pointer border-t border-border align-top transition-colors ${
                        isHighlighted ? 'bg-primary/10 ring-2 ring-inset ring-primary' : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="text-[15px] font-semibold leading-snug text-foreground">
                          {highlightWords(product.name, query)}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{product.code}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {priceGroups.length === 0 ? (
                          <span className="text-xs font-medium text-yellow-600">Harga belum diisi</span>
                        ) : (
                          <div className="space-y-1">
                            {priceGroups.map(({ uom, prices }) => (
                              <div key={uom.uomId} className="flex items-baseline gap-x-3 whitespace-nowrap text-xs">
                                <span className="w-12 shrink-0 font-semibold text-foreground">{uom.uomCode}</span>
                                {prices.map((price) => (
                                  <span key={price.priceTier} className="whitespace-nowrap text-muted-foreground">
                                    {price.priceTier}{' '}
                                    <span className="font-medium text-foreground">Rp {formatNumber(price.price)}</span>
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div
                          className={`font-semibold ${
                            product.stock <= 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                          }`}
                        >
                          {product.stock <= 0 ? `Habis (${stock.base})` : stock.base}
                        </div>
                        {stock.converted && <div className="text-xs text-muted-foreground">{stock.converted}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
