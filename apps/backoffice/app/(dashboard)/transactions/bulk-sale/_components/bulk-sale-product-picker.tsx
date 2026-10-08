'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import {
  changeChoiceUom,
  defaultPickChoice,
  parsePickQty,
  pricedUoms,
  type BulkSalePickChoice,
} from './bulk-sale-pick-choice'
import { orderedUomCandidates, pricesForUom } from './bulk-sale-pricing'
import type { BulkSaleProduct } from './types'

type BulkSaleProductPickerProps = {
  query: string
  onQueryChange: (query: string) => void
  results: BulkSaleProduct[]
  isSearching: boolean
  highlightIndex: number
  onHighlightChange: (index: number) => void
  onPick: (product: BulkSaleProduct, choice?: BulkSalePickChoice) => void
  onClose: () => void
  addedProductIds: Set<number>
  notice: { text: string; isError: boolean } | null
  /** PO Internal: tier bawaan = termurah. */
  internal?: boolean
}

type Editing = { productId: number; qty: string; uomId: number; priceTier: string }

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
  addedProductIds,
  notice,
  internal = false,
}: BulkSaleProductPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const [editing, setEditing] = useState<Editing | null>(null)
  const [editError, setEditError] = useState('')
  const editingProductId = editing?.productId

  useEffect(() => {
    if (editingProductId === undefined) return
    qtyRef.current?.focus()
    qtyRef.current?.select()
  }, [editingProductId])

  // Enter / klik produk = buka isian Qty · Satuan · Tier dulu; produk tanpa harga langsung
  // diteruskan supaya pesan "belum punya harga" tetap muncul dari tempat yang sama.
  function openEditor(product: BulkSaleProduct) {
    const choice = defaultPickChoice(product, internal)
    if (!choice) {
      onPick(product)
      return
    }
    setEditError('')
    setEditing({ productId: product.id, qty: String(choice.qty), uomId: choice.uomId, priceTier: choice.priceTier })
  }

  function closeEditor() {
    setEditing(null)
    setEditError('')
    inputRef.current?.focus()
  }

  function submitEditor(product: BulkSaleProduct) {
    if (!editing) return
    const qty = parsePickQty(editing.qty)
    if (qty === null) {
      setEditError('Qty harus angka bulat, minimal 1')
      qtyRef.current?.focus()
      return
    }
    onPick(product, { uomId: editing.uomId, priceTier: editing.priceTier, qty })
    closeEditor()
  }

  function handleEditorKeyDown(event: React.KeyboardEvent, product: BulkSaleProduct) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submitEditor(product)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeEditor()
    }
  }

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
      if (product) openEditor(product)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Pilih produk"
    >
      <div className="flex max-h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border p-3">
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setEditing(null)
                onQueryChange(event.target.value)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ketik sebagian nama produk, boleh beberapa kata (mis. royal kitten)..."
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Mencari...</span>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              ↑ ↓ pilih baris · Enter isi qty, satuan, tier · Enter lagi masukkan (jendela tetap terbuka) · Esc tutup
            </p>
            <div className="flex shrink-0 items-center gap-3">
              {notice && (
                <span
                  className={`text-xs font-medium ${
                    notice.isError ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'
                  }`}
                >
                  {notice.isError ? '⚠' : '✓'} {notice.text}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                Selesai
              </button>
            </div>
          </div>
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
                  const isEditing = editing?.productId === product.id
                  const uomOptions = isEditing ? pricedUoms(product) : []
                  const tierOptions = isEditing && editing ? pricesForUom(product.prices, editing.uomId) : []
                  return (
                    <Fragment key={product.id}>
                    <tr
                      ref={(element) => {
                        rowRefs.current[index] = element
                      }}
                      onMouseEnter={() => onHighlightChange(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        onHighlightChange(index)
                        openEditor(product)
                      }}
                      className={`cursor-pointer border-t border-border align-top transition-colors ${
                        isHighlighted ? 'bg-primary/10 ring-2 ring-inset ring-primary' : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="text-[15px] font-semibold leading-snug text-foreground">
                          {highlightWords(product.name, query)}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {product.code}
                          {addedProductIds.has(product.id) && <span className="ml-2 italic">sudah di daftar · pilih lagi = qty ditambah</span>}
                        </div>
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
                        {(product.reservedQty ?? 0) > 0 && (
                          <div className="text-xs text-amber-600">
                            ditahan {formatNumber(product.reservedQty ?? 0)} · tersedia{' '}
                            {formatNumber(product.stock - (product.reservedQty ?? 0))}
                          </div>
                        )}
                      </td>
                    </tr>
                    {isEditing && editing && (
                      <tr className="border-t border-primary/30 bg-primary/5">
                        <td colSpan={3} className="px-3 py-2.5">
                          <div
                            className="flex flex-wrap items-end gap-3"
                            onKeyDown={(event) => handleEditorKeyDown(event, product)}
                          >
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                              Qty
                              <input
                                ref={qtyRef}
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                                value={editing.qty}
                                onChange={(event) => {
                                  setEditError('')
                                  setEditing({ ...editing, qty: event.target.value })
                                }}
                                className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-right text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                              Satuan
                              <select
                                value={editing.uomId}
                                onChange={(event) => {
                                  const next = changeChoiceUom(
                                    product,
                                    { uomId: editing.uomId, priceTier: editing.priceTier, qty: 1 },
                                    Number(event.target.value),
                                    internal,
                                  )
                                  setEditing({ ...editing, uomId: next.uomId, priceTier: next.priceTier })
                                }}
                                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                              >
                                {uomOptions.map((uom) => (
                                  <option key={uom.uomId} value={uom.uomId}>
                                    {uom.uomCode}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                              Tier
                              <select
                                value={editing.priceTier}
                                onChange={(event) => setEditing({ ...editing, priceTier: event.target.value })}
                                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                              >
                                {tierOptions.map((price) => (
                                  <option key={price.priceTier} value={price.priceTier}>
                                    {price.priceTier} · Rp {formatNumber(price.price)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              onClick={() => submitEditor(product)}
                              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              Masukkan
                            </button>
                            <button
                              type="button"
                              onClick={closeEditor}
                              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                            >
                              Batal
                            </button>
                            <span className="text-xs text-muted-foreground">Tab pindah kolom · Enter masukkan · Esc batal</span>
                            {editError && <span className="text-xs font-medium text-red-600 dark:text-red-400">⚠ {editError}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
