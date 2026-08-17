'use client'

import { useState, useEffect, useCallback } from 'react'
import ExpenseDialog, { type EditableExpense } from './expense-dialog'

interface ShiftExpenseItem {
  id: number
  cashierId: number
  cashierName: string | null
  categoryName: string | null
  categoryCustom: string | null
  amount: number
  note: string
  createdAt: string
}

interface Props {
  shiftId: number
  cashierId: number
  /** Dinaikkan tiap kali pengeluaran baru dicatat dari luar komponen ini. */
  refreshKey?: number
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)

const formatTime = (value: string) => {
  const parsed = new Date(value)
  if (isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(parsed)
}

export default function ShiftExpenseList({ shiftId, cashierId, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<ShiftExpenseItem[]>([])
  const [total, setTotal] = useState(0)
  const [canManage, setCanManage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<EditableExpense | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ShiftExpenseItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/pos/shifts/${shiftId}/expenses`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal memuat daftar pengeluaran')
        return
      }
      const json = (await res.json()) as {
        data: ShiftExpenseItem[]
        totalAmount: number
        canManage: boolean
      }
      setItems(json.data)
      setTotal(json.totalAmount)
      setCanManage(json.canManage)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }, [shiftId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  async function handleDelete() {
    if (!confirmDelete) return
    setIsDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/pos/shifts/${shiftId}/expenses/${confirmDelete.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal menghapus pengeluaran')
        return
      }
      setConfirmDelete(null)
      await load()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-base font-semibold text-foreground">Pengeluaran Shift</h3>
        {items.length > 0 && (
          <span className="text-sm font-semibold text-destructive">{formatCurrency(total)}</span>
        )}
      </div>

      {error && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3">Belum ada pengeluaran di shift ini.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            // Kasir mengoreksi catatannya sendiri; atasan boleh menyentuh semuanya.
            const canEdit = item.cashierId === cashierId || canManage
            return (
              <li
                key={item.id}
                className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground break-words">
                    {item.categoryName ?? item.categoryCustom ?? item.note}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatTime(item.createdAt)} · {item.cashierName ?? `Kasir #${item.cashierId}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-sm font-semibold text-destructive whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </span>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            id: item.id,
                            amount: item.amount,
                            keterangan: item.categoryCustom ?? item.note,
                          })
                        }
                        className="min-h-[32px] px-2.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(item)}
                        className="min-h-[32px] px-2.5 rounded-md border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <ExpenseDialog
          shiftId={shiftId}
          cashierId={cashierId}
          expense={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" role="presentation" />
          <div
            className="relative w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-border p-6 shadow-xl z-10"
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi hapus pengeluaran"
          >
            <h2 className="text-lg font-bold text-foreground mb-2">Hapus Pengeluaran?</h2>
            <p className="text-sm text-muted-foreground">
              {confirmDelete.categoryCustom ?? confirmDelete.note} —{' '}
              <span className="font-medium text-foreground">{formatCurrency(confirmDelete.amount)}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Pengeluaran ini akan hilang dari perhitungan kas shift. Tindakan ini tidak bisa dibatalkan.
            </p>
            {error && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3 pt-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="flex-1 min-h-[44px] rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 min-h-[44px] rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
