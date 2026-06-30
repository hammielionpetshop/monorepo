'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCartStore } from './cart-store'
import type { BootstrapUom, PosProduct } from './pos-client'
import UomPriceDialog from './uom-price-dialog'

interface ProductSearchPanelProps {
  uoms: BootstrapUom[]
  branchId: number
  refreshKey?: number
}

const LIMIT = 20

// Jeda antar-tombol maksimum (ms) untuk dianggap input HID scanner.
// Manusia tak bisa konsisten <50ms/karakter; scanner jauh lebih cepat.
const SCAN_GAP_MS = 50

function formatRupiah(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num)
}

function ProductSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4 bg-card border border-border rounded-xl animate-pulse min-h-[80px]">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2 mt-auto" />
    </div>
  )
}

export default function ProductSearchPanel({ uoms, branchId, refreshKey }: ProductSearchPanelProps) {
  const [query, setQuery]             = useState('')
  const [products, setProducts]       = useState<PosProduct[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [isLoading, setIsLoading]     = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore]         = useState(false)
  const [noHargaAlert, setNoHargaAlert] = useState<string | null>(null)
  const [dialogProduct, setDialogProduct] = useState<PosProduct | null>(null)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const addItem = useCartStore((s) => s.addItem)
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null)
  const debounceRef   = useRef<NodeJS.Timeout | null>(null)
  const handleBarcodeFoundRef = useRef<(barcode: string) => void>(() => {})
  const searchInputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Pelacak burst keystroke untuk mendeteksi HID scanner pada kotak cari
  const lastKeyAtRef = useRef(0)
  const burstLenRef = useRef(0)

  const focusSearch = useCallback(() => {
    setTimeout(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }, 0)
  }, [])

  // Build UOM code map for display
  const uomMap = new Map<number, string>()
  for (const u of uoms) uomMap.set(u.id, u.code)

  const fetchProducts = useCallback(async (search: string, pageNum: number, append: boolean) => {
    if (append) setIsLoadingMore(true)
    else setIsLoading(true)

    try {
      const params = new URLSearchParams({
        search,
        page: String(pageNum),
        limit: String(LIMIT),
      })
      const res  = await fetch(`/api/pos/products?${params}`)
      const data = await res.json()

      if (append) {
        setProducts((prev) => [...prev, ...data.products])
      } else {
        setProducts(data.products)
        setHighlightIndex(0)
      }
      setTotal(data.total)
      setPage(pageNum)
      setHasMore(pageNum < data.totalPages)
    } finally {
      if (append) setIsLoadingMore(false)
      else setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchProducts('', 1, false)
  }, [fetchProducts])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchProducts(query, 1, false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchProducts])

  // Re-fetch setelah transaksi selesai agar stok tampil akurat
  useEffect(() => {
    if (!refreshKey) return
    fetchProducts(query, 1, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    }
  }, [])

  // Pastikan kartu ter-highlight selalu terlihat saat navigasi panah
  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-idx="${highlightIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  // Global keydown — HID/USB barcode scanner support + F2 shortcut
  useEffect(() => {
    let buffer = ''
    let bufferTimer: NodeJS.Timeout | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 → fokus ke kotak cari
      if (e.key === 'F2') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }

      const target = e.target as HTMLElement
      const tag = target.tagName.toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Enter') {
        if (bufferTimer) { clearTimeout(bufferTimer); bufferTimer = null }
        const captured = buffer
        buffer = ''
        if (captured.trim().length >= 3) handleBarcodeFoundRef.current(captured)
        return
      }

      if (e.key.length === 1) {
        buffer += e.key
        if (bufferTimer) clearTimeout(bufferTimer)
        bufferTimer = setTimeout(() => { buffer = ''; bufferTimer = null }, 300)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (bufferTimer) clearTimeout(bufferTimer)
    }
  }, [])

  // Barcode handler — called from scanner, fetches exact match
  handleBarcodeFoundRef.current = async (barcode: string) => {
    const trimmed = barcode.trim()
    if (trimmed.length < 3) return

    try {
      const res  = await fetch(`/api/pos/products?barcode=${encodeURIComponent(trimmed)}`)
      const data = await res.json()

      if (!data.products?.length) {
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
        setNoHargaAlert('Produk dengan barcode ini tidak ditemukan')
        alertTimerRef.current = setTimeout(() => setNoHargaAlert(null), 3000)
        return
      }

      setDialogProduct(data.products[0])
    } catch {
      // silent
    }
  }

  function handleLoadMore() {
    fetchProducts(query, page + 1, true)
  }

  return (
    <>
      {dialogProduct && (
        <UomPriceDialog
          product={dialogProduct}
          conversions={dialogProduct.conversions}
          prices={dialogProduct.prices}
          uoms={uoms}
          branchId={branchId}
          onClose={() => { setDialogProduct(null); focusSearch() }}
          onConfirm={({ uomId, uomCode, priceTier, unitPrice, qty, tierPrices }) => {
            addItem(
              {
                productId: dialogProduct.id,
                productName: dialogProduct.name,
                uomId,
                uomCode,
                priceTier,
                unitPrice,
                discountAmount: '0',
                tierPrices,
              },
              qty
            )
            setDialogProduct(null)
            focusSearch()
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        {/* Search input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg select-none">
            🔍
          </span>
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const now = Date.now()

              if (e.key === 'ArrowDown') {
                if (isLoading || products.length === 0) return
                e.preventDefault()
                setHighlightIndex((i) => Math.min(i + 1, products.length - 1))
                return
              }
              if (e.key === 'ArrowUp') {
                if (isLoading || products.length === 0) return
                e.preventDefault()
                setHighlightIndex((i) => Math.max(i - 1, 0))
                return
              }

              if (e.key === 'Enter') {
                e.preventDefault()
                const code = query.trim()
                // HID scanner mengetik barcode sebagai burst cepat lalu Enter
                // yang tiba sebelum debounce 300ms — daftar `products` masih
                // basi. Deteksi burst & lakukan lookup barcode persis.
                const isScan =
                  code.length >= 3 &&
                  burstLenRef.current >= 3 &&
                  now - lastKeyAtRef.current < SCAN_GAP_MS
                burstLenRef.current = 0

                if (isScan) {
                  setQuery('')
                  handleBarcodeFoundRef.current(code)
                } else if (!isLoading && products.length > 0) {
                  setDialogProduct(products[highlightIndex] ?? products[0])
                }
                return
              }

              if (e.key.length === 1) {
                burstLenRef.current =
                  now - lastKeyAtRef.current < SCAN_GAP_MS ? burstLenRef.current + 1 : 1
                lastKeyAtRef.current = now
              }
            }}
            placeholder="Cari produk, SKU, barcode… [F2]"
            className="w-full pl-10 pr-4 py-4 bg-background border border-input rounded-xl text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[52px]"
            autoComplete="off"
            autoFocus
          />
        </div>

        {/* Alert barcode tidak ditemukan */}
        {noHargaAlert && (
          <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold flex items-center gap-2">
            <span>⚠️</span> {noHargaAlert}
          </div>
        )}

        {/* Jumlah hasil */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground px-1">
            {query.trim()
              ? `${total} produk ditemukan`
              : `${total} produk tersedia`}
          </p>
        )}

        {/* Product grid */}
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
            : products.map((product, idx) => {
                const retailPrice =
                  product.prices.find(
                    (p) => p.uomId === product.baseUomId && p.tierType === 'RETAIL'
                  ) ?? null
                const uomCode = uomMap.get(product.baseUomId) ?? '-'
                const isHighlighted = idx === highlightIndex

                return (
                  <button
                    key={product.id}
                    type="button"
                    data-idx={idx}
                    onClick={() => setDialogProduct(product)}
                    onMouseMove={() => setHighlightIndex(idx)}
                    className={`flex flex-col gap-1 p-4 bg-card border rounded-xl text-left active:scale-[0.98] transition-all min-h-[80px] cursor-pointer ${
                      isHighlighted
                        ? 'border-primary ring-2 ring-primary/40 bg-accent'
                        : 'border-border hover:bg-accent hover:border-primary/30'
                    }`}
                  >
                    <span className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                      {product.name}
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <span className="text-xs text-muted-foreground">
                        {product.sku ?? '-'} · {uomCode}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {retailPrice ? (
                          formatRupiah(retailPrice.price)
                        ) : (
                          <span className="text-destructive text-xs">No harga</span>
                        )}
                      </span>
                    </div>
                    <span className={`text-xs ${Number(product.stock ?? '0') <= 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                      Stok: {product.stock ?? '0'}
                    </span>
                  </button>
                )
              })}

          {!isLoading && products.length === 0 && (
            <div className="col-span-2 py-12 text-center text-muted-foreground">
              <p className="text-3xl mb-2">🔍</p>
              <p className="text-sm">
                Produk tidak ditemukan untuk &quot;{query}&quot;
              </p>
            </div>
          )}
        </div>

        {/* Load more */}
        {hasMore && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="w-full py-3 rounded-xl border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? 'Memuat...' : `Muat lebih banyak (${products.length} / ${total})`}
          </button>
        )}
      </div>
    </>
  )
}
