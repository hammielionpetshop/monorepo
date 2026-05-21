'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useCartStore } from './cart-store'
import type { BootstrapProduct, BootstrapPrice, BootstrapUom } from './pos-client'
import Big from 'big.js'

interface ProductSearchPanelProps {
  products: BootstrapProduct[]
  prices: BootstrapPrice[]
  uoms: BootstrapUom[]
  branchId: number
}

function formatRupiah(value: string | number): string {
  const num = typeof value === 'string' ? new Big(value).toNumber() : value
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num)
}

export default function ProductSearchPanel({
  products,
  prices,
  uoms,
  branchId,
}: ProductSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [noHargaAlert, setNoHargaAlert] = useState<string | null>(null)
  const addItem = useCartStore((s) => s.addItem)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  // Memoize price map for O(1) key-based lookup: productId_uomId
  const priceMap = useMemo(() => {
    const map = new Map<string, BootstrapPrice>()
    for (const p of prices) {
      if (p.branchId === branchId && p.tierType === 'RETAIL') {
        map.set(`${p.productId}_${p.uomId}`, p)
      }
    }
    return map
  }, [prices, branchId])

  // Memoize UOM map for O(1) lookups
  const uomMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const u of uoms) {
      map.set(u.id, u.code)
    }
    return map
  }, [uoms])

  const filtered = useMemo(() => {
    if (!query.trim()) return products
    const q = query.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q)
    )
  }, [query, products])

  function handleAddProduct(product: BootstrapProduct) {
    const priceRecord = priceMap.get(`${product.id}_${product.baseUomId}`) ?? null
    if (!priceRecord) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      setNoHargaAlert(`Harga produk "${product.name}" tidak tersedia. Hubungi admin.`)
      timerRef.current = setTimeout(() => setNoHargaAlert(null), 3000)
      return
    }
    const uomCode = uomMap.get(product.baseUomId) ?? '-'
    addItem({
      productId: product.id,
      productName: product.name,
      uomId: product.baseUomId,
      uomCode,
      unitPrice: priceRecord.price.toString(),
      priceTier: 'RETAIL',
      discountAmount: '0',
    })
  }

  return (
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

      {/* Alert harga tidak ada */}
      {noHargaAlert && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold flex items-center gap-2">
          <span>⚠️</span> {noHargaAlert}
        </div>
      )}

      {/* Jumlah hasil */}
      <p className="text-xs text-muted-foreground px-1">
        {query.trim()
          ? `${filtered.length} produk ditemukan`
          : `${products.length} produk tersedia`}
      </p>

      {/* Product list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((product) => {
          const priceRecord = priceMap.get(`${product.id}_${product.baseUomId}`) ?? null
          const uomCode = uomMap.get(product.baseUomId) ?? '-'
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => handleAddProduct(product)}
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
                  {priceRecord ? formatRupiah(priceRecord.price.toString()) : (
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


        {filtered.length === 0 && (
          <div className="col-span-2 py-12 text-center text-muted-foreground">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm">Produk tidak ditemukan untuk &quot;{query}&quot;</p>
          </div>
        )}
      </div>
    </div>
  )
}
