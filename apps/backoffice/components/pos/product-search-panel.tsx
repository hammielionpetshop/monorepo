'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCartStore } from './cart-store'
import type { BootstrapUom, PosProduct } from './pos-client'
import UomPriceDialog from './uom-price-dialog'

interface ProductSearchPanelProps {
  uoms: BootstrapUom[]
  branchId: number
}

const LIMIT = 20

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

export default function ProductSearchPanel({ uoms, branchId }: ProductSearchPanelProps) {
  const [query, setQuery]             = useState('')
  const [products, setProducts]       = useState<PosProduct[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [isLoading, setIsLoading]     = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore]         = useState(false)
  const [noHargaAlert, setNoHargaAlert] = useState<string | null>(null)
  const [dialogProduct, setDialogProduct] = useState<PosProduct | null>(null)

  const addItem = useCartStore((s) => s.addItem)
  const alertTimerRef = useRef<NodeJS.Timeout | null>(null)
  const debounceRef   = useRef<NodeJS.Timeout | null>(null)
  const handleBarcodeFoundRef = useRef<(barcode: string) => void>(() => {})

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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    }
  }, [])

  // Global keydown — HID/USB barcode scanner support
  useEffect(() => {
    let buffer = ''
    let bufferTimer: NodeJS.Timeout | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
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
          onClose={() => setDialogProduct(null)}
          onConfirm={({ uomId, uomCode, priceTier, unitPrice, qty }) => {
            addItem(
              {
                productId: dialogProduct.id,
                productName: dialogProduct.name,
                uomId,
                uomCode,
                priceTier,
                unitPrice,
                discountAmount: '0',
              },
              qty
            )
            setDialogProduct(null)
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
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama produk, SKU, atau barcode..."
            className="w-full pl-10 pr-4 py-4 bg-background border border-input rounded-xl text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[52px]"
            autoComplete="off"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
            : products.map((product) => {
                const retailPrice =
                  product.prices.find(
                    (p) => p.uomId === product.baseUomId && p.tierType === 'RETAIL'
                  ) ?? null
                const uomCode = uomMap.get(product.baseUomId) ?? '-'

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setDialogProduct(product)}
                    className="flex flex-col gap-1 p-4 bg-card border border-border rounded-xl text-left hover:bg-accent hover:border-primary/30 active:scale-[0.98] transition-all min-h-[80px] cursor-pointer"
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
                    <span className="text-xs text-muted-foreground">
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
