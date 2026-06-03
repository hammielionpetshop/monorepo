'use client'

import { useState, useEffect } from 'react'
import Big from 'big.js'
import type { BootstrapProduct, BootstrapPrice, BootstrapConversion, BootstrapUom } from './pos-client'

interface UomOption {
  uomId: number
  uomCode: string
  label: string // e.g. "Box (12 Pcs)"
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
  const uomMap = new Map(uoms.map((u) => [u.id, u]))

  // Build UOM options: base UOM + conversion UOMs
  const uomOptions: UomOption[] = []

  const baseUom = uomMap.get(product.baseUomId)
  if (baseUom) {
    uomOptions.push({ uomId: baseUom.id, uomCode: baseUom.code, label: baseUom.code })
  }

  for (const conv of conversions.filter((c) => c.productId === product.id)) {
    const u = uomMap.get(conv.uomId)
    if (!u) continue
    const ratioLabel = conv.ratio ? ` (${new Big(conv.ratio).toFixed(0)} ${baseUom?.code ?? ''})` : ''
    uomOptions.push({ uomId: u.id, uomCode: u.code, label: `${u.code}${ratioLabel}` })
  }

  const [selectedUomId, setSelectedUomId] = useState<number>(uomOptions[0]?.uomId ?? product.baseUomId)
  const [selectedTier, setSelectedTier] = useState<string>('')
  const [qty, setQty] = useState(1)

  // Price tiers for selected UOM
  const tierOptions: PriceTierOption[] = prices
    .filter((p) => p.productId === product.id && p.branchId === branchId && p.uomId === selectedUomId)
    .map((p) => ({ tierType: p.tierType, price: p.price }))

  // Auto-select first tier when UOM changes
  useEffect(() => {
    setSelectedTier(tierOptions[0]?.tierType ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUomId])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const selectedPrice = tierOptions.find((t) => t.tierType === selectedTier)?.price ?? null

  const handleConfirm = () => {
    if (!selectedPrice || !selectedTier) return
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
        </div>

        <div className="p-5 space-y-5">
          {/* UOM selection */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Satuan</p>
            <div className="flex flex-wrap gap-2">
              {uomOptions.map((opt) => (
                <button
                  key={opt.uomId}
                  type="button"
                  onClick={() => setSelectedUomId(opt.uomId)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors min-h-[40px] ${
                    selectedUomId === opt.uomId
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
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
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Jumlah</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-accent text-foreground font-bold text-xl transition-colors"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center text-lg font-bold border border-border rounded-lg min-h-[44px] bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-accent text-foreground font-bold text-xl transition-colors"
              >
                +
              </button>
              {selectedPrice && (
                <span className="text-sm font-bold text-foreground ml-auto">
                  = {formatRupiah(new Big(selectedPrice).times(qty).round(0).toString())}
                </span>
              )}
            </div>
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
            disabled={!selectedPrice || !selectedTier}
            className="flex-1 bg-primary text-primary-foreground font-semibold rounded-lg min-h-[48px] hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  )
}
