'use client'

import { useEffect, useRef, useState } from 'react'
import type { PoProductUom } from './po-item-defaults'

export interface PoProduct {
  id: number
  name: string
  sku: string | null
  baseUomCode: string
  stock: number
  uoms: PoProductUom[]
}

const fmt = (n: number) => n.toLocaleString('id-ID')

function highlightWords(name: string, query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return name
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = name.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-700/60">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

function describeStock(p: PoProduct) {
  const base = `${fmt(p.stock)} ${p.baseUomCode}`
  const largest = [...p.uoms].sort((a, b) => b.ratio - a.ratio)[0]
  if (!largest || largest.ratio <= 1 || p.stock <= 0) return { base, converted: null }
  const converted = Math.floor(p.stock / largest.ratio)
  return { base, converted: converted > 0 ? `≈ ${fmt(converted)} ${largest.code}` : null }
}

/**
 * Jendela pilih produk untuk PO — pola yang sama dengan Bulk Sale: ketik beberapa kata dalam
 * urutan bebas, ↑ ↓ pilih, Enter masukkan, jendela tetap terbuka untuk produk berikutnya.
 */
export default function PoProductPicker({
  branchId,
  addedIds,
  onPick,
  onClose,
}: {
  branchId: string
  addedIds: Set<number>
  onPick: (product: PoProduct) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PoProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    rowRefs.current[highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsSearching(true)
      setError('')
      try {
        const res = await fetch(
          `/api/bo/purchase-orders/products?branchId=${branchId}&q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Gagal mencari produk')
        setResults(data)
        setHighlight(0)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message)
      } finally {
        setIsSearching(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, branchId])

  function pick(product: PoProduct | undefined) {
    if (!product || addedIds.has(product.id)) return
    onPick(product)
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(results[highlight])
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Pilih produk"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border p-3">
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik sebagian nama produk, boleh beberapa kata (mis. royal kitten)..."
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Mencari...</span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            ↑ ↓ pilih baris · Enter masukkan ke PO (jendela tetap terbuka) · Esc tutup
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error ? (
            <div className="px-4 py-10 text-center text-sm text-destructive">{error}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {!query.trim() ? 'Mulai ketik nama produk.' : isSearching ? 'Mencari...' : 'Produk tidak ditemukan'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Nama Produk</th>
                  <th className="w-[45%] px-3 py-2 text-left text-xs font-medium text-muted-foreground">Satuan · Modal terakhir</th>
                  <th className="w-36 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Stok cabang</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p, i) => {
                  const added = addedIds.has(p.id)
                  const stock = describeStock(p)
                  return (
                    <tr
                      key={p.id}
                      ref={(el) => {
                        rowRefs.current[i] = el
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        pick(p)
                      }}
                      className={`border-t border-border align-top transition-colors ${
                        added ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${i === highlight ? 'bg-primary/10 ring-2 ring-inset ring-primary' : 'hover:bg-muted/40'}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="text-[15px] font-semibold leading-snug text-foreground">
                          {highlightWords(p.name, query)}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {p.sku ?? '-'}
                          {added && <span className="ml-2 italic">sudah di PO</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          {[...p.uoms].sort((a, b) => b.ratio - a.ratio).map((u) => (
                            <div key={u.uomId} className="flex items-baseline gap-x-2 whitespace-nowrap text-xs">
                              <span className="w-12 shrink-0 font-semibold text-foreground">{u.code}</span>
                              {!u.isBase && <span className="text-muted-foreground">= {fmt(u.ratio)} {p.baseUomCode}</span>}
                              <span className={u.cost ? 'font-medium text-foreground' : 'text-yellow-600'}>
                                {u.cost ? `Rp ${fmt(u.cost)}` : 'modal belum ada'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className={`font-semibold ${p.stock <= 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                          {p.stock <= 0 ? `Habis (${stock.base})` : stock.base}
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
