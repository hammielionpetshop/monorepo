'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useCartStore } from './cart-store'
import type { BootstrapProduct, BootstrapPrice, BootstrapConversion, BootstrapUom } from './pos-client'
import UomPriceDialog from './uom-price-dialog'
import Big from 'big.js'

interface ProductSearchPanelProps {
  products: BootstrapProduct[]
  prices: BootstrapPrice[]
  conversions: BootstrapConversion[]
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
  conversions,
  uoms,
  branchId,
}: ProductSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [noHargaAlert, setNoHargaAlert] = useState<string | null>(null)
  const [dialogProduct, setDialogProduct] = useState<BootstrapProduct | null>(null)
  const addItem = useCartStore((s) => s.addItem)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Stable ref untuk barcode handler — di-update tiap render agar selalu capture closure terbaru
  const handleBarcodeFoundRef = useRef<(barcode: string) => void>(() => {})

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  // Global keydown listener untuk HID/USB barcode scanner
  // Scanner mengirim karakter seperti keyboard (cepat, < 300ms antar char) diakhiri Enter
  // Tidak mengintervensi input manual — skip jika target adalah input/textarea/select
  useEffect(() => {
    let buffer = ''
    let bufferTimer: NodeJS.Timeout | null = null

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tagName = target.tagName.toUpperCase()
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return

      if (e.key === 'Enter') {
        if (bufferTimer) {
          clearTimeout(bufferTimer)
          bufferTimer = null
        }
        const captured = buffer
        buffer = ''
        if (captured.trim().length >= 3) {
          handleBarcodeFoundRef.current(captured)
        }
        return
      }

      // Hanya karakter yang bisa dicetak (printable characters)
      if (e.key.length === 1) {
        buffer += e.key
        // Reset buffer jika tidak ada input baru dalam 300ms
        if (bufferTimer) clearTimeout(bufferTimer)
        bufferTimer = setTimeout(() => {
          buffer = ''
          bufferTimer = null
        }, 300)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (bufferTimer) clearTimeout(bufferTimer)
    }
  }, []) // Intentional empty deps — handleBarcodeFoundRef.current selalu up-to-date via ref

  // Memoize price map for O(1) key-based lookup: productId_uomId (RETAIL only, for display on product cards)
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
    // Selalu buka dialog untuk pilih UOM + harga
    setDialogProduct(product)
  }

  // Update barcode handler ref setiap render — closure selalu punya products, priceMap, uomMap terbaru
  handleBarcodeFoundRef.current = (barcode: string) => {
    const trimmed = barcode.trim()
    if (trimmed.length < 3) return

    const product = products.find(
      (p) => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
    )

    if (!product) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setNoHargaAlert(`Produk dengan barcode ini tidak ditemukan`)
      timerRef.current = setTimeout(() => setNoHargaAlert(null), 3000)
      return
    }

    handleAddProduct(product)
  }

  return (
    <>
    {dialogProduct && (
      <UomPriceDialog
        product={dialogProduct}
        conversions={conversions}
        prices={prices}
        uoms={uoms}
        branchId={branchId}
        onClose={() => setDialogProduct(null)}
        onConfirm={({ uomId, uomCode, priceTier, unitPrice, qty }) => {
          addItem({
            productId: dialogProduct.id,
            productName: dialogProduct.name,
            uomId,
            uomCode,
            priceTier,
            unitPrice,
            discountAmount: '0',
          }, qty)
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
    </>
  )
}
