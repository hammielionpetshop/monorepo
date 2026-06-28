'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Big from 'big.js'
import type { BootstrapProduct, BootstrapPrice, BootstrapConversion, BootstrapUom } from './pos-client'
import { useCartStore } from './cart-store'

interface UomOption {
  uomId: number
  uomCode: string
  label: string
  ratioToBase: string // ratio to base UOM, "1" for base UOM itself
}

interface PriceTierOption {
  tierType: string
  price: string
}

interface UomPriceDialogProps {
  product: BootstrapProduct
  conversions: BootstrapConversion[]
  prices: BootstrapPrice[]
  uoms: BootstrapUom[]
  branchId: number
  onConfirm: (selection: {
    uomId: number
    uomCode: string
    priceTier: string
    unitPrice: string
    qty: number
    tierPrices: Record<string, string>
  }) => void
  onClose: () => void
}

function formatRupiah(value: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(new Big(value).toNumber())
}

export default function UomPriceDialog({
  product,
  conversions,
  prices,
  uoms,
  branchId,
  onConfirm,
  onClose,
}: UomPriceDialogProps) {
  const cartItems = useCartStore((s) => s.items)
  const uomMap = useMemo(() => new Map(uoms.map((u) => [u.id, u])), [uoms])

  // Build UOM options: base UOM (ratio=1) + conversion UOMs
  const uomOptions: UomOption[] = useMemo(() => {
    const opts: UomOption[] = []
    const baseUom = uomMap.get(product.baseUomId)
    if (baseUom) {
      opts.push({ uomId: baseUom.id, uomCode: baseUom.code, label: baseUom.code, ratioToBase: '1' })
    }
    for (const conv of conversions.filter((c) => c.productId === product.id)) {
      const u = uomMap.get(conv.uomId)
      if (!u || !conv.ratio) continue
      const ratioLabel = ` (${new Big(conv.ratio).toFixed(0)} ${baseUom?.code ?? ''})`
      opts.push({ uomId: u.id, uomCode: u.code, label: `${u.code}${ratioLabel}`, ratioToBase: conv.ratio })
    }
    return opts
  }, [conversions, product, uomMap])

  const [selectedUomId, setSelectedUomId] = useState<number>(uomOptions[0]?.uomId ?? product.baseUomId)
  const [selectedTier, setSelectedTier] = useState<string>('')
  const [qty, setQty] = useState(1)
  const qtyInputRef = useRef<HTMLInputElement>(null)

  // Hitung stok yang sudah dipakai di cart (dalam base UOM)
  const usedInCartBaseUom = useMemo(() => {
    return cartItems
      .filter((i) => i.productId === product.id)
      .reduce((acc, i) => {
        const opt = uomOptions.find((o) => o.uomId === i.uomId)
        const ratio = opt ? new Big(opt.ratioToBase) : new Big(1)
        return acc.plus(new Big(i.qty).times(ratio))
      }, new Big(0))
  }, [cartItems, product.id, uomOptions])

  // Stok tersedia (base UOM) setelah dikurangi cart
  const availableBaseUom = useMemo(() => {
    const total = new Big(product.stock || '0')
    const net = total.minus(usedInCartBaseUom)
    return net.lt(0) ? new Big(0) : net
  }, [product.stock, usedInCartBaseUom])

  // Ratio base UOM untuk UOM yang dipilih
  const selectedRatioToBase = useMemo(() => {
    const opt = uomOptions.find((o) => o.uomId === selectedUomId)
    return opt ? new Big(opt.ratioToBase) : new Big(1)
  }, [uomOptions, selectedUomId])

  // Max qty yang bisa dipilih untuk UOM ini
  const maxQty = useMemo(() => {
    if (selectedRatioToBase.lte(0)) return 0
    return Math.floor(availableBaseUom.div(selectedRatioToBase).toNumber())
  }, [availableBaseUom, selectedRatioToBase])

  // Price tiers for selected UOM
  const tierOptions: PriceTierOption[] = prices
    .filter((p) => p.productId === product.id && p.branchId === branchId && p.uomId === selectedUomId)
    .map((p) => ({ tierType: p.tierType, price: p.price }))

  // Reset tier saat UOM berganti (qty tidak di-clamp — oversell diizinkan)
  useEffect(() => {
    setSelectedTier(tierOptions[0]?.tierType ?? '')
    setQty((q) => Math.max(1, q))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUomId])

  // Auto-fokus qty input saat dialog buka
  useEffect(() => {
    const timer = setTimeout(() => {
      qtyInputRef.current?.focus()
      qtyInputRef.current?.select()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const selectedPrice = tierOptions.find((t) => t.tierType === selectedTier)?.price ?? null
  const isOverStock = qty > maxQty
  // Oversell diizinkan — cukup harga & tier terpilih
  const canConfirm = !!selectedPrice && !!selectedTier

  const handleQtyChange = (newQty: number) => {
    setQty(Math.max(1, newQty))
  }

  const handleConfirm = () => {
    if (!canConfirm || !selectedPrice) return
    const selectedUom = uomOptions.find((u) => u.uomId === selectedUomId)
    const tierPrices: Record<string, string> = {}
    for (const t of tierOptions) {
      tierPrices[t.tierType] = new Big(t.price).round(0).toString()
    }
    onConfirm({
      uomId: selectedUomId,
      uomCode: selectedUom?.uomCode ?? '-',
      priceTier: selectedTier,
      unitPrice: new Big(selectedPrice).round(0).toString(),
      qty,
      tierPrices,
    })
  }

  // ESC tutup · Enter konfirmasi · ←/→ ganti satuan · ↑/↓ ganti tier harga
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }

      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && uomOptions.length > 1) {
        e.preventDefault()
        const cur = uomOptions.findIndex((o) => o.uomId === selectedUomId)
        const dir = e.key === 'ArrowRight' ? 1 : -1
        const next = (cur + dir + uomOptions.length) % uomOptions.length
        setSelectedUomId(uomOptions[next].uomId)
        return
      }

      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && tierOptions.length > 1) {
        e.preventDefault()
        const cur = tierOptions.findIndex((t) => t.tierType === selectedTier)
        const dir = e.key === 'ArrowDown' ? 1 : -1
        const next = (cur + dir + tierOptions.length) % tierOptions.length
        setSelectedTier(tierOptions[next].tierType)
        return
      }

      if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement).tagName.toUpperCase()
        if (tag !== 'BUTTON' && canConfirm) {
          e.preventDefault()
          handleConfirm()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, canConfirm, handleConfirm, uomOptions, tierOptions, selectedUomId, selectedTier])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Pilih UOM & Harga</p>
          <h2 className="text-base font-bold text-foreground leading-tight line-clamp-2">{product.name}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Stok tersedia: <span className="font-semibold text-foreground">{availableBaseUom.toFixed(0)} {uomMap.get(product.baseUomId)?.code ?? ''}</span>
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* UOM selection */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Satuan
              {uomOptions.length > 1 && (
                <kbd className="ml-2 font-mono font-normal normal-case opacity-50">←/→</kbd>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {uomOptions.map((opt) => {
                const optMax = Math.floor(availableBaseUom.div(new Big(opt.ratioToBase)).toNumber())
                return (
                  <button
                    key={opt.uomId}
                    type="button"
                    onClick={() => setSelectedUomId(opt.uomId)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[40px] ${
                      selectedUomId === opt.uomId
                        ? 'bg-primary text-primary-foreground border-primary'
                        : optMax === 0
                        ? 'bg-background text-amber-600 border-amber-400/60 hover:bg-accent'
                        : 'bg-background text-foreground border-border hover:bg-accent'
                    }`}
                    title={optMax === 0 ? 'Stok habis — penjualan akan membuat stok minus' : undefined}
                  >
                    {opt.label}
                    {optMax === 0 && <span className="ml-1 text-xs">(Stok 0)</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price tier selection */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Harga
              {tierOptions.length > 1 && (
                <kbd className="ml-2 font-mono font-normal normal-case opacity-50">↑/↓</kbd>
              )}
            </p>
            {tierOptions.length === 0 ? (
              <p className="text-sm text-destructive">Tidak ada harga untuk UOM ini. Hubungi admin.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tierOptions.map((tier) => (
                  <button
                    key={tier.tierType}
                    type="button"
                    onClick={() => setSelectedTier(tier.tierType)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-colors min-h-[40px] text-left ${
                      selectedTier === tier.tierType
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-accent'
                    }`}
                  >
                    <span className="font-medium">{tier.tierType}</span>
                    <span className="ml-2 font-bold">{formatRupiah(tier.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Qty */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jumlah</p>
              {maxQty > 0 && (
                <p className="text-xs text-muted-foreground">Maks: <span className="font-semibold">{maxQty}</span></p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQtyChange(qty - 1)}
                disabled={qty <= 1}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-accent text-foreground font-bold text-xl transition-colors disabled:opacity-40"
              >
                −
              </button>
              <input
                ref={qtyInputRef}
                type="text"
                inputMode="numeric"
                value={qty.toLocaleString('id-ID')}
                onChange={(e) => handleQtyChange(parseInt(e.target.value.replace(/\D/g, ''), 10) || 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) { e.preventDefault(); handleConfirm() }
                }}
                className={`w-20 text-center text-lg font-bold border rounded-lg min-h-[44px] bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  isOverStock ? 'border-amber-400' : 'border-border'
                }`}
              />
              <button
                type="button"
                onClick={() => handleQtyChange(qty + 1)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-accent text-foreground font-bold text-xl transition-colors disabled:opacity-40"
              >
                +
              </button>
              {selectedPrice && (
                <span className="text-sm font-bold text-foreground ml-auto">
                  = {formatRupiah(new Big(selectedPrice).times(qty).round(0).toString())}
                </span>
              )}
            </div>

            {isOverStock && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                ⚠ Melebihi stok tersedia ({maxQty} {uomOptions.find(o => o.uomId === selectedUomId)?.uomCode ?? ''}). Stok akan tercatat minus.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-border text-foreground font-medium rounded-lg min-h-[48px] hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 bg-primary text-primary-foreground font-semibold rounded-lg min-h-[48px] hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tambah ke Keranjang <kbd className="ml-1 text-xs opacity-60 font-mono font-normal">Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
