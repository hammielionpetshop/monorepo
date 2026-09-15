'use client'

import { useState } from 'react'
import type { Category, Brand } from './types'

interface BulkCategoryBrandDialogProps {
  selectedCount: number
  categories: Category[]
  brands: Brand[]
  submitting: boolean
  onConfirm: (categoryId: number | undefined, brandId: number | undefined) => void
  onCancel: () => void
}

const UNCHANGED = ''

export default function BulkCategoryBrandDialog({
  selectedCount,
  categories,
  brands,
  submitting,
  onConfirm,
  onCancel,
}: BulkCategoryBrandDialogProps) {
  const [categoryId, setCategoryId] = useState(UNCHANGED)
  const [brandId, setBrandId] = useState(UNCHANGED)

  const canConfirm = (categoryId !== UNCHANGED || brandId !== UNCHANGED) && !submitting

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm(
      categoryId === UNCHANGED ? undefined : Number(categoryId),
      brandId === UNCHANGED ? undefined : Number(brandId)
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Assign Kategori & Brand Massal</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Berlaku untuk {selectedCount} produk terpilih. Biarkan &quot;Jangan ubah&quot; pada field yang tidak ingin diganti.
          </p>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={UNCHANGED}>-- Jangan ubah --</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Brand</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={UNCHANGED}>-- Jangan ubah --</option>
              {brands.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Menyimpan...' : `Terapkan ke ${selectedCount} produk`}
          </button>
        </div>
      </div>
    </div>
  )
}
