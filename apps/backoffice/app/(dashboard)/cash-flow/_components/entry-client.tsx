'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import EntryForm from './entry-form'
import { TYPE_LABELS, type CashFlowCategoryOption, type CashFlowEntry, type CashFlowType } from './types'

interface Props {
  categories: CashFlowCategoryOption[]
  currentUserName: string
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

type FilterType = 'ALL' | CashFlowType

const entryColumns: ColumnDef<CashFlowEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Tanggal',
    cell: ({ row }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {formatWIB(row.original.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    ),
  },
  {
    id: 'type',
    header: 'Tipe',
    cell: ({ row }) => (
      <span
        className={[
          'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
          row.original.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
        ].join(' ')}
      >
        {TYPE_LABELS[row.original.type]}
      </span>
    ),
  },
  {
    accessorKey: 'categoryName',
    header: 'Kategori',
    cell: ({ row }) => row.original.categoryName ?? '-',
  },
  {
    accessorKey: 'note',
    header: 'Catatan',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.note ?? '-'}</span>,
  },
  {
    accessorKey: 'createdByName',
    header: 'Oleh',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.createdByName ?? '-'}</span>,
  },
  {
    id: 'amount',
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => (
      <div className={`text-right font-medium whitespace-nowrap ${row.original.type === 'INCOME' ? 'text-green-600' : 'text-destructive'}`}>
        {row.original.type === 'INCOME' ? '+' : '-'}{IDR.format(row.original.amount)}
      </div>
    ),
  },
]

export default function EntryClient({ categories, currentUserName }: Props) {
  const [entries, setEntries] = useState<CashFlowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 5000)
    return () => clearTimeout(t)
  }, [errorMsg])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bo/cash-flow/entries')
      if (!res.ok) {
        setErrorMsg('Gagal memuat daftar transaksi kas')
        return
      }
      setEntries(await res.json())
    } catch {
      setErrorMsg('Gagal memuat daftar transaksi kas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const filteredEntries = useMemo(
    () => (filter === 'ALL' ? entries : entries.filter((e) => e.type === filter)),
    [entries, filter]
  )

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const e of entries) {
      if (e.type === 'INCOME') income += e.amount
      else expense += e.amount
    }
    return { income, expense, net: income - expense }
  }, [entries])

  async function handleSuccess() {
    setSuccessMsg('Transaksi kas berhasil dicatat')
    await loadEntries()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div>
        <div className="border border-border rounded-lg bg-card p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Catat Transaksi</h2>
          <EntryForm
            categories={categories}
            currentUserName={currentUserName}
            onSuccess={handleSuccess}
            onError={(msg) => setErrorMsg(msg)}
          />
        </div>
      </div>

      <div>
        {successMsg && (
          <div role="status" aria-live="polite" className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
            {successMsg}
          </div>
        )}
        {errorMsg && !successMsg && (
          <div role="alert" aria-live="assertive" className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="border border-border rounded-lg bg-card p-3">
            <p className="text-xs text-muted-foreground">Total Pendapatan</p>
            <p className="text-sm font-semibold text-green-600 mt-1">{IDR.format(totals.income)}</p>
          </div>
          <div className="border border-border rounded-lg bg-card p-3">
            <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
            <p className="text-sm font-semibold text-destructive mt-1">{IDR.format(totals.expense)}</p>
          </div>
          <div className="border border-border rounded-lg bg-card p-3">
            <p className="text-xs text-muted-foreground">Selisih</p>
            <p className={`text-sm font-semibold mt-1 ${totals.net >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {IDR.format(totals.net)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          {(['ALL', 'INCOME', 'EXPENSE'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent',
              ].join(' ')}
            >
              {f === 'ALL' ? 'Semua' : TYPE_LABELS[f]}
            </button>
          ))}
        </div>

        <DataTable
          data={filteredEntries}
          columns={entryColumns}
          emptyMessage="Belum ada transaksi kas"
          isLoading={loading}
          loadingMessage="Memuat..."
        />
      </div>
    </div>
  )
}
