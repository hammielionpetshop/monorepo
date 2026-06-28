'use client'

import { useEffect, useMemo } from 'react'
import { useCartStore } from './cart-store'

interface BulkTierDialogProps {
  onClose: () => void
}

export default function BulkTierDialog({ onClose }: BulkTierDialogProps) {
  const items = useCartStore((s) => s.items)
  const setBulkTier = useCartStore((s) => s.setBulkTier)

  // Kumpulkan semua tier yang tersedia di seluruh item + berapa item yang punya tier itu.
  const tiers = useMemo(() => {
    const counter = new Map<string, number>()
    for (const it of items) {
      for (const tier of Object.keys(it.tierPrices ?? {})) {
        counter.set(tier, (counter.get(tier) ?? 0) + 1)
      }
    }
    return Array.from(counter.entries())
      .map(([tierType, applicable]) => ({ tierType, applicable }))
      .sort((a, b) => a.tierType.localeCompare(b.tierType))
  }, [items])

  const totalItems = items.length

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handlePick = (tier: string) => {
    setBulkTier(tier)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Ubah Tier Harga</p>
          <h2 className="text-base font-bold text-foreground leading-tight">
            Terapkan ke semua item keranjang
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Harga tiap item diperbarui ke tier terpilih. Item yang tidak memiliki tier ini dibiarkan apa adanya.
          </p>
        </div>

        <div className="p-5 space-y-2">
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada tier harga yang tersedia.</p>
          ) : (
            tiers.map((t) => {
              const allCovered = t.applicable === totalItems
              return (
                <button
                  key={t.tierType}
                  type="button"
                  onClick={() => handlePick(t.tierType)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg border border-border bg-background hover:bg-accent hover:border-primary/40 transition-colors min-h-[52px] text-left active:scale-[0.98]"
                >
                  <span className="text-sm font-semibold text-foreground">{t.tierType}</span>
                  <span className={`text-xs ${allCovered ? 'text-muted-foreground' : 'text-amber-600'}`}>
                    {allCovered ? `${t.applicable} item` : `berlaku untuk ${t.applicable}/${totalItems} item`}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full border border-border text-foreground font-medium rounded-lg min-h-[48px] hover:bg-muted transition-colors"
          >
            Batal <kbd className="ml-1 text-xs opacity-60 font-mono font-normal">Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
