'use client'

import { useState, useEffect } from 'react'
import type { CartItem } from './cart-store'
import { formatRupiah } from './cart-store'

interface HoldBillDialogProps {
  shiftId: number
  branchId: number
  items: CartItem[]
  grandTotal: string
  customerId: number | null
  onClose: () => void
  onSuccess: () => void
}

export default function HoldBillDialog({
  shiftId,
  branchId,
  items,
  grandTotal,
  customerId,
  onClose,
  onSuccess,
}: HoldBillDialogProps) {
  const [billName, setBillName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanName = billName.trim()
    if (cleanName.length > 100) {
      setError('Nama bill terlalu panjang (maksimal 100 karakter)')
      return
    }

    if (items.length === 0) {
      setError('Keranjang kosong, tidak ada yang bisa ditahan')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/pos/open-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          shiftId,
          billName: cleanName || null,
          items,
          customerId: customerId ?? null,
          totalAmount: Number(grandTotal),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal menahan transaksi')
        return
      }
      onSuccess()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 transition-opacity duration-200" role="presentation" />

      <div
        className="relative w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-border p-6 shadow-xl z-10 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Tahan Transaksi"
      >
        <div className="mb-5 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-foreground">Tahan Transaksi</h2>
            <p className="text-sm text-muted-foreground">
              {items.length} item · {formatRupiah(grandTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full transition-colors disabled:opacity-40"
            aria-label="Tutup dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="hold-bill-name" className="block text-sm font-medium text-foreground mb-1">
              Nama Bill (opsional)
            </label>
            <input
              id="hold-bill-name"
              type="text"
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              placeholder="Contoh: Pak Budi / Meja 3"
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              disabled={isSubmitting}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Dikosongkan akan diberi nama otomatis berdasarkan jam.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 min-h-[44px] rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
            >
              {isSubmitting ? 'Menyimpan...' : 'Tahan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
