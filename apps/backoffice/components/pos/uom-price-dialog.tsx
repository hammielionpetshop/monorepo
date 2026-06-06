'use client'

import { useState, useEffect, useMemo } from 'react'
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

  // Reset tier dan clamp qty saat UOM berganti
  useEffect(() => {
    setSelectedTier(tierOptions[0]?.tierType ?? '')
    setQty((q) => Math.min(q, Math.max(1, maxQty)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUomId])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedPrice = tierOptions.find((t) => t.tierType === selectedTier)?.price ?? null
  const isOverStock = qty > maxQty
  const canConfirm = !!selectedPrice && !!selectedTier && !isOverStock && maxQty > 0

  const handleQtyChange = (newQty: number) => {
    setQty(Math.min(Math.max(1, newQty), Math.max(1, maxQty)))
  }

  const handleConfirm = () => {
    if (!canConfirm || !selectedPrice) return
    const selectedUom = uomOptions.find((u) => u.uomId === selectedUomId)
    onConfirm({
      uomId: selectedUomId,
      uomCode: selectedUom?.uomCode ?? '-',
      priceTier: selectedTier,
      unitPrice: new Big(selectedPrice).round(0).toString(),
      qty,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
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
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Satuan</p>
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
                        ? 'opacity-40 cursor-not-allowed bg-background text-muted-foreground border-border'
                        : 'bg-background text-foreground border-border hover:bg-accent'
                    }`}
                    disabled={optMax === 0}
                    title={optMax === 0 ? 'Stok tidak mencukupi' : undefined}
                  >
                    {opt.label}
                    {optMax === 0 && <span className="ml-1 text-xs">(Habis)</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price tier selection */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Harga</p>
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

            {maxQty === 0 ? (
              <p className="text-sm text-destructive font-medium">Stok tidak mencukupi untuk satuan ini.</p>
            ) : (
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
                  type="text"
                  inputMode="numeric"
                  value={qty.toLocaleString('id-ID')}
                  onChange={(e) => handleQtyChange(parseInt(e.target.value.replace(/\D/g, ''), 10) || 1)}
                  className={`w-20 text-center text-lg font-bold border rounded-lg min-h-[44px] bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isOverStock ? 'border-destructive' : 'border-border'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleQtyChange(qty + 1)}
                  disabled={qty >= maxQty}
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
            )}

            {isOverStock && maxQty > 0 && (
              <p className="text-xs text-destructive mt-1">Melebihi stok tersedia ({maxQty} {uomOptions.find(o => o.uomId === selectedUomId)?.uomCode ?? ''})</p>
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
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  )
}
