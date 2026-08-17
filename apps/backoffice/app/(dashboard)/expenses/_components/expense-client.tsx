'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import ExpenseEditForm from './expense-edit-form'
import { EMPTY_FILTERS, type ExpenseFilters, type Option, type ShiftExpense } from './types'

interface Props {
  branches: Option[]
  cashiers: Option[]
  categories: Option[]
  /** Cabang tunggal → dropdown cabang disembunyikan, tidak ada pilihan untuk dibuat. */
  showBranchFilter: boolean
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatDateTime(value: string) {
  return formatWIB(value, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ExpenseClient({ branches, cashiers, categories, showBranchFilter }: Props) {
  const [draft, setDraft] = useState<ExpenseFilters>(EMPTY_FILTERS)
  const [data, setData] = useState<ShiftExpense[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [canManage, setCanManage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [editing, setEditing] = useState<ShiftExpense | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ShiftExpense | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  const fetchList = useCallback(async (filters: ExpenseFilters) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.branchId) params.set('branchId', filters.branchId)
      if (filters.cashierId) params.set('cashierId', filters.cashierId)
      if (filters.categoryId) params.set('categoryId', filters.categoryId)
      if (filters.onlyOpenShift) params.set('onlyOpenShift', 'true')
      if (filters.q.trim()) params.set('q', filters.q.trim())

      const res = await fetch(`/api/bo/shift-expenses?${params.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal mengambil data')
      }
      const payload = json as { data: ShiftExpense[]; totalAmount: number; canManage: boolean }
      setData(payload.data)
      setTotalAmount(payload.totalAmount)
      setCanManage(payload.canManage)
    } catch (err) {
      setData([])
      setTotalAmount(0)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(EMPTY_FILTERS)
  }, [fetchList])

  function applyFilters() {
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      setError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir')
      return
    }
    fetchList(draft)
  }

  function resetFilters() {
    setDraft(EMPTY_FILTERS)
    setError(null)
    fetchList(EMPTY_FILTERS)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/shift-expenses/${confirmDelete.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Gagal menghapus pengeluaran')
      }
      setConfirmDelete(null)
      setSuccessMsg('Pengeluaran berhasil dihapus')
      await fetchList(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns: ColumnDef<ShiftExpense>[] = useMemo(() => {
    const base: ColumnDef<ShiftExpense>[] = [
      {
        accessorKey: 'createdAt',
        header: 'Waktu',
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: 'branchName',
        header: 'Cabang',
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">{row.original.branchName ?? '-'}</span>
        ),
      },
      {
        id: 'shift',
        header: 'Shift',
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            #{row.original.shiftNumber}
            {row.original.shiftStatus === 'OPEN' && (
              <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border bg-blue-500/10 text-blue-600 border-blue-500/20">
                Berjalan
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'cashierName',
        header: 'Kasir',
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {row.original.cashierName ?? `Kasir #${row.original.cashierId}`}
          </span>
        ),
      },
      {
        id: 'category',
        header: 'Kategori',
        cell: ({ row }) => row.original.categoryName ?? row.original.categoryCustom ?? '-',
      },
      {
        accessorKey: 'note',
        header: 'Catatan',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.note}</span>,
      },
      {
        id: 'amount',
        header: () => <div className="text-right">Jumlah</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium text-destructive whitespace-nowrap">
            {IDR.format(row.original.amount)}
          </div>
        ),
      },
    ]

    if (!canManage) return base

    return [
      ...base,
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const isOpen = row.original.shiftStatus === 'OPEN'
          if (!isOpen) {
            return (
              <span
                className="text-xs text-muted-foreground whitespace-nowrap"
                title="Shift sudah ditutup — angkanya sudah ikut direkonsiliasi, jadi tidak bisa diubah lagi"
              >
                Terkunci
              </span>
            )
          }
          return (
            <div className="flex gap-1.5 whitespace-nowrap">
              <button
                onClick={() => setEditing(row.original)}
                className="px-2.5 py-1.5 text-xs font-medium border border-border rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                Ubah
              </button>
              <button
                onClick={() => setConfirmDelete(row.original)}
                className="px-2.5 py-1.5 text-xs font-medium border border-destructive/30 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
              >
                Hapus
              </button>
            </div>
          )
        },
      },
    ]
  }, [canManage])

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="f-start" className="text-xs font-medium text-muted-foreground">Tanggal Mulai</label>
            <input
              id="f-start"
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-end" className="text-xs font-medium text-muted-foreground">Tanggal Akhir</label>
            <input
              id="f-end"
              type="date"
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          {showBranchFilter && (
            <div className="flex flex-col gap-1">
              <label htmlFor="f-branch" className="text-xs font-medium text-muted-foreground">Cabang</label>
              <select
                id="f-branch"
                value={draft.branchId}
                onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}
                className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
              >
                <option value="">Semua Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="f-cashier" className="text-xs font-medium text-muted-foreground">Kasir</label>
            <select
              id="f-cashier"
              value={draft.cashierId}
              onChange={(e) => setDraft({ ...draft, cashierId: e.target.value })}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            >
              <option value="">Semua Kasir</option>
              {cashiers.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-category" className="text-xs font-medium text-muted-foreground">Kategori</label>
            <select
              id="f-category"
              value={draft.categoryId}
              onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-q" className="text-xs font-medium text-muted-foreground">Cari Catatan</label>
            <input
              id="f-q"
              type="text"
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters() }}
              placeholder="mis. galon"
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.onlyOpenShift}
              onChange={(e) => setDraft({ ...draft, onlyOpenShift: e.target.checked })}
              className="rounded border-border"
            />
            Hanya shift berjalan
          </label>
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Terapkan Filter
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {successMsg && (
        <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}
      {error && (
        <div role="alert" className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-xs text-muted-foreground">Jumlah Catatan</p>
          <p className="text-sm font-semibold text-foreground mt-1">{data.length}</p>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
          <p className="text-sm font-semibold text-destructive mt-1">{IDR.format(totalAmount)}</p>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-xs text-muted-foreground">Masih Bisa Diubah</p>
          <p className="text-sm font-semibold text-foreground mt-1">
            {data.filter((e) => e.shiftStatus === 'OPEN').length}
          </p>
        </div>
      </div>

      <DataTable
        data={data}
        columns={columns}
        emptyMessage="Tidak ada pengeluaran untuk filter yang dipilih"
        isLoading={isLoading}
        loadingMessage="Memuat data pengeluaran..."
        pageSize={20}
      />

      {editing && (
        <ExpenseEditForm
          expense={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setSuccessMsg('Pengeluaran berhasil diperbarui')
            fetchList(draft)
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md m-4 p-6">
            <h3 className="text-base font-semibold text-foreground mb-2">Hapus Pengeluaran?</h3>
            <p className="text-sm text-muted-foreground">
              {confirmDelete.categoryName ?? confirmDelete.categoryCustom ?? confirmDelete.note} —{' '}
              <span className="font-medium text-foreground">{IDR.format(confirmDelete.amount)}</span>
              {' '}(Shift #{confirmDelete.shiftNumber}, {confirmDelete.branchName ?? '-'})
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Kas yang diharapkan saat settlement shift ini akan naik sebesar jumlah tersebut.
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex gap-3 pt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
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
