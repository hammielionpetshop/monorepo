'use client'

import { useState, useEffect } from 'react'

interface ExpenseDialogProps {
  shiftId: number
  cashierId: number
  onClose: () => void
  onSuccess: () => void
}

export default function ExpenseDialog({
  shiftId,
  cashierId,
  onClose,
  onSuccess,
}: ExpenseDialogProps) {
  const [keterangan, setKeterangan] = useState('')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Tutup dengan ESC saat tidak mensubmit
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

    const cleanKeterangan = keterangan.trim()
    if (!cleanKeterangan) {
      setError('Keterangan wajib diisi')
      return
    }

    if (cleanKeterangan.length > 100) {
      setError('Keterangan terlalu panjang (maksimal 100 karakter)')
      return
    }

    const cleanAmountStr = amount.trim()
    if (!cleanAmountStr) {
      setError('Jumlah wajib diisi')
      return
    }

    // Validasi regex ketat untuk hanya menerima angka bulat positif (tanpa minus atau desimal)
    if (!/^\d+$/.test(cleanAmountStr)) {
      setError('Jumlah harus berupa angka bulat positif')
      return
    }

    const amountInt = parseInt(cleanAmountStr, 10)
    if (isNaN(amountInt) || amountInt <= 0) {
      setError('Jumlah harus lebih dari 0')
      return
    }

    // Hindari luapan integer 32-bit di database
    if (amountInt > 2147483647) {
      setError('Jumlah pengeluaran melebihi batas maksimum yang diperbolehkan')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/pos/shifts/${shiftId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId,
          categoryId: null,
          categoryCustom: cleanKeterangan,
          note: cleanKeterangan,
          amount: amountInt,
          proofImage: null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal mencatat pengeluaran')
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        onClick={() => !isSubmitting && onClose()}
        role="presentation"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-border p-6 shadow-xl z-10 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Catat Pengeluaran Shift"
      >
        <div className="mb-5 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-foreground">Catat Pengeluaran</h2>
            <p className="text-sm text-muted-foreground">Shift Expense</p>
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
            <label
              htmlFor="expense-keterangan"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Keterangan
            </label>
            <input
              id="expense-keterangan"
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Beli air galon 2 buah"
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              htmlFor="expense-amount"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Jumlah (Rp)
            </label>
            <input
              id="expense-amount"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              disabled={isSubmitting}
            />
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
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
