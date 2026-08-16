'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import type { BranchOption, ReturnListRow, ReturnListResult } from './types'
import ReturDetailModal from './retur-detail-modal'

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
]

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(iso: string): string {
  return formatWIB(iso, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Filters {
  page: number
  q: string
  status: string
  branchId: string
  dateFrom: string
  dateTo: string
}

interface Props {
  branches: BranchOption[]
  isPrivileged: boolean
  canCancel: boolean
  activeBranchId: number
  activeBranchName: string
  initialFilters: Filters
}

export default function ReturHistoryClient({
  branches,
  isPrivileged,
  canCancel,
  activeBranchId,
  activeBranchName,
  initialFilters,
}: Props) {
  const router = useRouter()

  const [data, setData] = useState<ReturnListRow[]>([])
  const [summary, setSummary] = useState<ReturnListResult['summary']>({
    activeCount: 0,
    cancelledCount: 0,
    activeRefundAmount: 0,
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialFilters.page)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [q, setQ] = useState(initialFilters.q)
  const [status, setStatus] = useState(initialFilters.status)
  const [branchId, setBranchId] = useState(initialFilters.branchId)
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom)
  const [dateTo, setDateTo] = useState(initialFilters.dateTo)

  const [detailTarget, setDetailTarget] = useState<{ id: string; returnNumber: string } | null>(null)

  const [cancelTarget, setCancelTarget] = useState<ReturnListRow | null>(null)
  const [cancelPin, setCancelPin] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const fetchData = useCallback(async (params: Filters) => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      sp.set('page', String(params.page))
      if (params.q) sp.set('q', params.q)
      if (params.status) sp.set('status', params.status)
      if (params.branchId) sp.set('branchId', params.branchId)
      if (params.dateFrom) sp.set('dateFrom', params.dateFrom)
      if (params.dateTo) sp.set('dateTo', params.dateTo)

      const res = await fetch(`/api/bo/retur?${sp}`)
      const json: ReturnListResult & { error?: string } = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal mengambil riwayat retur')
        return
      }
      setData(json.data)
      setSummary(json.summary)
      setTotal(json.total)
      setPage(json.page)
      setTotalPages(json.totalPages)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(initialFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (!cancelTarget) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCancelModal()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [cancelTarget])

  function currentFilters(overrides: Partial<Filters> = {}): Filters {
    return {
      page: overrides.page ?? page,
      q: overrides.q ?? q,
      status: overrides.status ?? status,
      branchId: overrides.branchId ?? branchId,
      dateFrom: overrides.dateFrom ?? dateFrom,
      dateTo: overrides.dateTo ?? dateTo,
    }
  }

  function pushUrl(next: Filters) {
    const sp = new URLSearchParams()
    if (next.page > 1) sp.set('page', String(next.page))
    if (next.q) sp.set('q', next.q)
    if (next.status) sp.set('status', next.status)
    if (next.branchId) sp.set('branchId', next.branchId)
    if (next.dateFrom) sp.set('dateFrom', next.dateFrom)
    if (next.dateTo) sp.set('dateTo', next.dateTo)
    const query = sp.toString()
    router.push(query ? `/retur/riwayat?${query}` : '/retur/riwayat')
  }

  function handleApply() {
    const next = currentFilters({ page: 1 })
    pushUrl(next)
    fetchData(next)
  }

  function handleReset() {
    setQ('')
    setStatus('')
    setBranchId('')
    setDateFrom('')
    setDateTo('')
    const next: Filters = { page: 1, q: '', status: '', branchId: '', dateFrom: '', dateTo: '' }
    pushUrl(next)
    fetchData(next)
  }

  function handlePageChange(newPage: number) {
    const next = currentFilters({ page: newPage })
    pushUrl(next)
    fetchData(next)
  }

  function openCancelModal(row: ReturnListRow) {
    setCancelTarget(row)
    setCancelPin('')
    setCancelReason('')
    setCancelError(null)
  }

  function closeCancelModal() {
    setCancelTarget(null)
    setCancelPin('')
    setCancelReason('')
    setCancelError(null)
  }

  async function handleSubmitCancel() {
    if (!cancelTarget) return
    if (!cancelReason.trim()) {
      setCancelError('Alasan pembatalan wajib diisi')
      return
    }
    if (cancelPin.trim().length < 4) {
      setCancelError('PIN Owner minimal 4 digit')
      return
    }

    setCancelLoading(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/bo/retur/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cancelPin.trim(), reason: cancelReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCancelError(json.error ?? 'Gagal membatalkan retur')
        return
      }
      setSuccessMsg(`Retur ${cancelTarget.returnNumber} berhasil dibatalkan. Stok sudah ditarik ulang.`)
      closeCancelModal()
      fetchData(currentFilters())
    } catch {
      setCancelError('Terjadi kesalahan jaringan')
    } finally {
      setCancelLoading(false)
    }
  }

  const colSpan = isPrivileged ? 9 : 8

  return (
    <div className="space-y-4">
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800"
        >
          {successMsg}
        </div>
      )}

      {/* Ringkasan — dihitung atas seluruh hasil filter, bukan hanya halaman ini */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Retur Aktif</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{summary.activeCount}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Nilai Refund (Aktif)</p>
          <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
            {formatRupiah(summary.activeRefundAmount)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground">Retur Dibatalkan</p>
          <p className="text-2xl font-bold text-muted-foreground mt-1 tabular-nums">{summary.cancelledCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">No. Retur / Transaksi</label>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApply()}
              placeholder="RTN-... atau TRX-..."
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {isPrivileged && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cabang</label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Semua Cabang</option>
                {branches.map(b => (
                  <option key={b.id} value={String(b.id)}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Memuat...' : 'Terapkan Filter'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
        >
          {error}
        </div>
      )}

      {/* Tabel */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">No. Retur</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Tanggal</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">No. Transaksi</th>
                {isPrivileged && (
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cabang</th>
                )}
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Diproses Oleh</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-right">Item</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-right">Refund</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
                    Memuat data...
                  </td>
                </tr>
              )}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-10 text-center text-muted-foreground">
                    Belum ada retur yang cocok dengan filter ini.
                  </td>
                </tr>
              )}
              {!loading && data.map(row => {
                const cancelled = row.cancelledAt !== null
                const cancellableHere = canCancel && !cancelled && row.branchId === activeBranchId
                return (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-primary font-medium">
                      <button
                        type="button"
                        onClick={() => setDetailTarget({ id: row.id, returnNumber: row.returnNumber })}
                        className="hover:underline text-left focus:outline-none"
                      >
                        {row.returnNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-foreground">
                      {row.trxNumber}
                    </td>
                    {isPrivileged && (
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{row.branchName}</td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">{row.processedByName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums text-muted-foreground">
                      {row.itemCount} <span className="text-xs">({row.totalQty} qty)</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums font-medium text-foreground">
                      {formatRupiah(row.totalRefundAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          cancelled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {cancelled ? 'Dibatalkan' : 'Aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailTarget({ id: row.id, returnNumber: row.returnNumber })}
                          className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/10 transition-colors"
                        >
                          Detail
                        </button>
                        {cancellableHere && (
                          <button
                            type="button"
                            onClick={() => openCancelModal(row)}
                            className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
                          >
                            Batalkan
                          </button>
                        )}
                        {canCancel && !cancelled && row.branchId !== activeBranchId && (
                          <span
                            className="text-xs text-muted-foreground"
                            title={`Pembatalan memakai PIN Owner cabang bersangkutan. Pindah cabang aktif dari ${activeBranchName} dulu.`}
                          >
                            Pindah cabang untuk batalkan
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginasi */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Halaman <span className="font-medium text-foreground">{page}</span> dari{' '}
            <span className="font-medium text-foreground">{totalPages}</span>{' '}
            (<span className="font-medium text-foreground">{total}</span> data)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* Modal Pembatalan */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Batalkan Retur</h3>
              <button
                type="button"
                onClick={closeCancelModal}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Retur <span className="font-mono font-medium text-foreground">{cancelTarget.returnNumber}</span>{' '}
                senilai <span className="font-medium text-foreground">{formatRupiah(cancelTarget.totalRefundAmount)}</span> akan dibatalkan.
              </p>
              <div className="px-3 py-2 rounded-md text-sm bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                <span className="font-semibold">Perhatian:</span> stok yang sempat dikembalikan akan{' '}
                <span className="font-semibold">ditarik ulang</span> dari cabang ini. Pastikan barang fisiknya
                memang tidak jadi diterima kembali.
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Alasan Pembatalan <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Tuliskan alasan pembatalan retur..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  PIN Owner <span className="text-destructive">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={cancelPin}
                  onChange={e => setCancelPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PIN Owner cabang {activeBranchName}.
                </p>
              </div>

              {cancelError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
                >
                  {cancelError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={closeCancelModal}
                disabled={cancelLoading}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitCancel}
                disabled={cancelLoading}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {cancelLoading ? 'Membatalkan...' : 'Batalkan Retur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <ReturDetailModal
          returnId={detailTarget.id}
          returnNumber={detailTarget.returnNumber}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </div>
  )
}
