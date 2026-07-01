'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CartItem } from './cart-store'
import { formatRupiah } from './cart-store'

interface OpenBill {
  id: number
  billName: string | null
  customerId: number | null
  items: unknown
  totalAmount: number
  createdAt: string
}

interface OpenBillsDrawerProps {
  hasActiveCart: boolean
  onClose: () => void
  onResume: (items: CartItem[]) => void
}

function parseItems(raw: unknown): CartItem[] {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(value) ? (value as CartItem[]) : []
  } catch {
    return []
  }
}

export default function OpenBillsDrawer({ hasActiveCart, onClose, onResume }: OpenBillsDrawerProps) {
  const [bills, setBills] = useState<OpenBill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchBills = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pos/open-bills')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal mengambil daftar tunggu')
        return
      }
      const data = (await res.json()) as OpenBill[]
      setBills(data)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBills()
  }, [fetchBills])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && busyId === null) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busyId, onClose])

  const handleResume = async (bill: OpenBill) => {
    const items = parseItems(bill.items)
    if (items.length === 0) {
      setError('Data bill tidak valid, tidak bisa dilanjutkan')
      return
    }
    if (
      hasActiveCart &&
      !confirm('Keranjang saat ini akan diganti dengan transaksi yang ditahan. Lanjutkan?')
    ) {
      return
    }
    setBusyId(bill.id)
    try {
      const res = await fetch(`/api/pos/open-bills/${bill.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal melanjutkan transaksi')
        return
      }
      onResume(items)
      onClose()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (bill: OpenBill) => {
    if (!confirm('Hapus transaksi yang ditahan ini? Tindakan ini tidak dapat dibatalkan.')) return
    setBusyId(bill.id)
    try {
      const res = await fetch(`/api/pos/open-bills/${bill.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal menghapus transaksi')
        return
      }
      setBills((prev) => prev.filter((b) => b.id !== bill.id))
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} role="presentation" />

      <div
        className="relative w-full max-w-md bg-card border-l border-border h-full flex flex-col shadow-xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Daftar Tunggu"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Daftar Tunggu</h2>
            <p className="text-sm text-muted-foreground">Transaksi yang ditahan</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full transition-colors"
            aria-label="Tutup"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="px-6 py-3 text-sm text-destructive border-b border-border" role="alert">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Memuat…
            </div>
          ) : bills.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
              <p className="text-3xl mb-2">🕒</p>
              <p className="text-sm">Tidak ada transaksi yang ditahan</p>
            </div>
          ) : (
            bills.map((bill) => {
              const itemCount = parseItems(bill.items).length
              const isBusy = busyId === bill.id
              return (
                <div key={bill.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">
                        {bill.billName || `Bill #${bill.id}`}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(bill.createdAt).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(bill)}
                      disabled={isBusy}
                      className="text-destructive hover:text-destructive/70 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                      aria-label="Hapus transaksi ditahan"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      {itemCount} item · <span className="font-semibold text-foreground">{formatRupiah(String(bill.totalAmount))}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResume(bill)}
                      disabled={isBusy}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 active:scale-[0.98]"
                    >
                      {isBusy ? '…' : 'Lanjutkan'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
