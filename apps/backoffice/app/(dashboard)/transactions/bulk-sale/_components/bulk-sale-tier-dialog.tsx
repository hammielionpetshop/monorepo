'use client'

import { useEffect, useMemo } from 'react'
import { compareTier, pricesForUom } from './bulk-sale-pricing'
import type { BulkSaleRow } from './types'

type BulkSaleTierDialogProps = {
  rows: BulkSaleRow[]
  onPick: (tier: string) => void
  onClose: () => void
}

export default function BulkSaleTierDialog({ rows, onPick, onClose }: BulkSaleTierDialogProps) {
  // Tier dihitung per satuan baris: GROSIR yang hanya ada di SAK tidak berlaku untuk
  // baris yang dijual per KG.
  const tiers = useMemo(() => {
    const counter = new Map<string, number>()
    for (const row of rows) {
      for (const price of pricesForUom(row.availablePrices, row.uomId)) {
        counter.set(price.priceTier, (counter.get(price.priceTier) ?? 0) + 1)
      }
    }
    return Array.from(counter.entries())
      .map(([tierType, applicable]) => ({ tierType, applicable }))
      .sort((a, b) => compareTier(a.tierType, b.tierType))
  }, [rows])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ubah tier harga semua item"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-muted-foreground">Ubah Tier Harga</p>
          <h2 className="text-base font-bold leading-tight text-foreground">Terapkan ke semua item</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Harga tiap item diperbarui ke tier terpilih (harga custom ikut tertimpa). Item yang tidak memiliki tier ini
            dibiarkan apa adanya.
          </p>
        </div>

        <div className="space-y-2 p-5">
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada tier harga yang tersedia.</p>
          ) : (
            tiers.map((tier, index) => {
              const allCovered = tier.applicable === rows.length
              return (
                <button
                  key={tier.tierType}
                  type="button"
                  autoFocus={index === 0}
                  onClick={() => onPick(tier.tierType)}
                  className="flex min-h-[52px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <span className="text-sm font-semibold text-foreground">{tier.tierType}</span>
                  <span className={`text-xs ${allCovered ? 'text-muted-foreground' : 'text-amber-600'}`}>
                    {allCovered ? `${tier.applicable} item` : `berlaku untuk ${tier.applicable}/${rows.length} item`}
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
            className="min-h-[48px] w-full rounded-lg border border-border font-medium text-foreground transition-colors hover:bg-muted"
          >
            Batal <kbd className="ml-1 font-mono text-xs font-normal opacity-60">Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
