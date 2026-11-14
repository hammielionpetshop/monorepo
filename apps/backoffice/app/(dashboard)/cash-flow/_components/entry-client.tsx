'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { ProofPhotoLink } from '@/components/ui/proof-photo-field'
import EntryForm from './entry-form'
import {
  TYPE_LABELS, REPORT_KIND_LABELS, monthLabel,
  type BranchOption, type CashFlowCategoryOption, type CashFlowEntry, type CashFlowType, type MoneyPlaceOption,
} from './types'

interface Props {
  categories: CashFlowCategoryOption[]
  places: MoneyPlaceOption[]
  branches: BranchOption[]
  closedMonths: string[]
  currentUserName: string
  activeBranchId: number
  canRecord: boolean
  isOwner: boolean
  today: string
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

type FilterType = 'ALL' | CashFlowType

function firstOfMonth(today: string): string {
  return `${today.slice(0, 7)}-01`
}

function formatDate(value: string): string {
  return formatWIB(`${value}T12:00:00+07:00`, { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function EntryClient({ categories, places, branches, closedMonths, currentUserName, activeBranchId, canRecord, isOwner, today }: Props) {
  const [entries, setEntries] = useState<CashFlowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [from, setFrom] = useState(firstOfMonth(today))
  const [to, setTo] = useState(today)
  const [branch, setBranch] = useState('')
  const [placeFilter, setPlaceFilter] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<CashFlowEntry | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

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
      const qs = new URLSearchParams()
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      if (branch) qs.set('branch', branch)
      if (placeFilter) qs.set('moneyPlaceId', placeFilter)
      if (showCancelled) qs.set('includeCancelled', '1')
      const res = await fetch(`/api/bo/cash-flow/entries?${qs.toString()}`)
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
  }, [from, to, branch, placeFilter, showCancelled])

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
      if (e.cancelledAt) continue
      if (e.type === 'INCOME') income += e.amount
      else expense += e.amount
    }
    return { income, expense, net: income - expense }
  }, [entries])

  async function handleSuccess() {
    setSuccessMsg('Transaksi kas berhasil dicatat')
    await loadEntries()
  }

  async function submitCancel() {
    if (!cancelTarget || cancelling) return
    if (cancelReason.trim().length < 3) return setCancelError('Alasan pembatalan wajib diisi')
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/bo/cash-flow/entries/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCancelError(data.error ?? 'Gagal membatalkan catatan')
        return
      }
      setCancelTarget(null)
      setCancelReason('')
      setSuccessMsg('Catatan dibatalkan — catat ulang bila perlu')
      await loadEntries()
    } catch {
      setCancelError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setCancelling(false)
    }
  }

  const entryColumns: ColumnDef<CashFlowEntry>[] = [
    {
      accessorKey: 'occurredOn',
      header: 'Tanggal uang',
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <div className={row.original.cancelledAt ? 'line-through text-muted-foreground' : 'text-foreground'}>{formatDate(row.original.occurredOn)}</div>
          <div className="text-xs text-muted-foreground">untuk {monthLabel(row.original.forMonth)}</div>
          {row.original.correctionReason && (
            <div className="mt-1 max-w-[220px] whitespace-normal rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
              <span className="font-semibold">Koreksi {monthLabel(row.original.forMonth)}:</span> {row.original.correctionReason}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Tipe',
      cell: ({ row }) => (
        <div className="space-y-1">
          <span
            className={[
              'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
              row.original.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
            ].join(' ')}
          >
            {TYPE_LABELS[row.original.type]}
          </span>
          {row.original.cancelledAt && (
            <span className="block w-fit px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">Batal</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'categoryName',
      header: 'Kategori',
      cell: ({ row }) => (
        <div>
          <div>{row.original.categoryName ?? '-'}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.reportKind ? REPORT_KIND_LABELS[row.original.reportKind] : 'jenis belum dipilih'}
          </div>
          {row.original.fromRecurringCost && <div className="text-xs text-primary">dari Biaya Rutin</div>}
        </div>
      ),
    },
    {
      id: 'branch',
      header: 'Cabang',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.branchId === null ? 'Bersama' : row.original.branchName ?? '-'}</span>,
    },
    {
      id: 'place',
      header: 'Tempat Uang',
      cell: ({ row }) =>
        row.original.moneyPlaceName ? (
          <span>{row.original.moneyPlaceName}</span>
        ) : (
          <span className="italic text-muted-foreground">belum diketahui</span>
        ),
    },
    {
      accessorKey: 'note',
      header: 'Catatan',
      cell: ({ row }) => (
        <div className="text-muted-foreground space-y-0.5">
          <div>{row.original.note ?? '-'}</div>
          <ProofPhotoLink url={row.original.proofPhotoUrl} />
          {!row.original.proofPhotoUrl && !row.original.categoryIsSystem && <div className="text-xs">tanpa bukti</div>}
          {row.original.cancelledAt && (
            <div className="text-xs text-destructive">
              Dibatalkan {row.original.cancelledByName ?? ''}: {row.original.cancelReason}
            </div>
          )}
        </div>
      ),
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
        <div
          className={[
            'text-right font-medium whitespace-nowrap',
            row.original.cancelledAt ? 'line-through text-muted-foreground' : row.original.type === 'INCOME' ? 'text-green-600' : 'text-destructive',
          ].join(' ')}
        >
          {row.original.type === 'INCOME' ? '+' : '-'}{IDR.format(row.original.amount)}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.canCancel ? (
          <button
            onClick={() => { setCancelTarget(row.original); setCancelReason(''); setCancelError(null) }}
            className="text-xs font-medium text-destructive hover:underline"
          >
            Batalkan
          </button>
        ) : null,
    },
  ]

  return (
    <div className={canRecord ? 'grid gap-6 lg:grid-cols-[360px_1fr]' : ''}>
      {canRecord && (
        <div>
          <div className="border border-border rounded-lg bg-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Catat Transaksi</h2>
            <EntryForm
              categories={categories}
              places={places}
              branches={branches}
              closedMonths={closedMonths}
              currentUserName={currentUserName}
              activeBranchId={activeBranchId}
              isOwner={isOwner}
              today={today}
              onSuccess={handleSuccess}
              onError={(msg) => setErrorMsg(msg)}
            />
          </div>
        </div>
      )}

      <div className="min-w-0">
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

        <div className="flex flex-wrap items-end gap-3 mb-3 text-sm">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tanggal uang dari</label>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">sampai</label>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background" />
          </div>
          {canRecord && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cabang</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background">
                <option value="">Semua cabang</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                <option value="shared">Bersama</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tempat Uang</label>
            <select value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background">
              <option value="">Semua</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="unknown">Belum diketahui</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 pb-1.5">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Tampilkan yang batal
          </label>
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

        <div className="overflow-x-auto">
          <DataTable
            data={filteredEntries}
            resetPageKey={`${filter}-${from}-${to}-${branch}-${placeFilter}-${showCancelled}`}
            columns={entryColumns}
            emptyMessage="Belum ada transaksi kas"
            isLoading={loading}
            loadingMessage="Memuat..."
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Catatan tidak bisa diubah atau dihapus. Yang salah dibatalkan dengan alasan (tetap terlihat bertanda Batal), lalu dicatat ulang.
          Pencatat bisa membatalkan catatannya sendiri pada hari yang sama; sesudah itu oleh Owner/GM.
        </p>
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Batalkan catatan?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {cancelTarget.categoryName} · {IDR.format(cancelTarget.amount)} · {formatDate(cancelTarget.occurredOn)}. Catatan tetap terlihat bertanda Batal dan tidak dihitung lagi.
              </p>
            </div>
            <div>
              <label htmlFor="cancel-reason" className="block text-sm font-medium text-foreground mb-1">
                Alasan <span className="text-destructive">*</span>
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                maxLength={255}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background resize-none"
                placeholder="Mis. salah ketik nominal"
              />
            </div>
            {cancelError && <div role="alert" className="text-sm text-destructive">{cancelError}</div>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                onClick={submitCancel}
                disabled={cancelling}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {cancelling ? 'Membatalkan...' : 'Batalkan catatan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
