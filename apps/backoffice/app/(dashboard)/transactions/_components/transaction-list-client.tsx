'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import type { TransactionRow, TransactionListResponse, BranchOption } from './types'

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'PENDING_VOID', label: 'Menunggu Void' },
  { value: 'VOIDED', label: 'Dibatalkan' },
]

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  VOIDED: 'bg-red-100 text-red-700',
  PENDING_VOID: 'bg-yellow-100 text-yellow-800',
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Selesai',
  VOIDED: 'Dibatalkan',
  PENDING_VOID: 'Menunggu Void',
}

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

interface Props {
  branches: BranchOption[]
  isPrivileged: boolean
  initialPage: number
  initialQ: string
  initialStatus: string
  initialBranchId: string
  initialDateFrom: string
  initialDateTo: string
}

export default function TransactionListClient({
  branches,
  isPrivileged,
  initialPage,
  initialQ,
  initialStatus,
  initialBranchId,
  initialDateFrom,
  initialDateTo,
}: Props) {
  const router = useRouter()

  const [data, setData] = useState<TransactionRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState(initialQ)
  const [status, setStatus] = useState(initialStatus)
  const [branchId, setBranchId] = useState(initialBranchId)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)

  const [voidModal, setVoidModal] = useState<{ trxNumber: string; trxId: number } | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidLoading, setVoidLoading] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const fetchData = useCallback(async (params: {
    page: number
    q: string
    status: string
    branchId: string
    dateFrom: string
    dateTo: string
  }) => {
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

      const res = await fetch(`/api/bo/transactions?${sp}`)
      const json: TransactionListResponse & { error?: string } = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Gagal mengambil data transaksi')
        return
      }
      setData(json.data)
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
    fetchData({ page: initialPage, q: initialQ, status: initialStatus, branchId: initialBranchId, dateFrom: initialDateFrom, dateTo: initialDateTo })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!voidModal) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeVoidModal()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [voidModal])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  function pushUrl(overrides: Partial<{ page: number; q: string; status: string; branchId: string; dateFrom: string; dateTo: string }>) {
    const next = {
      page: overrides.page ?? page,
      q: overrides.q ?? q,
      status: overrides.status ?? status,
      branchId: overrides.branchId ?? branchId,
      dateFrom: overrides.dateFrom ?? dateFrom,
      dateTo: overrides.dateTo ?? dateTo,
    }
    const sp = new URLSearchParams()
    if (next.page > 1) sp.set('page', String(next.page))
    if (next.q) sp.set('q', next.q)
    if (next.status) sp.set('status', next.status)
    if (next.branchId) sp.set('branchId', next.branchId)
    if (next.dateFrom) sp.set('dateFrom', next.dateFrom)
    if (next.dateTo) sp.set('dateTo', next.dateTo)
    router.push(`/transactions?${sp}`)
    return next
  }

  function handleApply() {
    const params = pushUrl({ page: 1 })
    fetchData(params)
  }

  function handleReset() {
    setQ('')
    setStatus('')
    setBranchId('')
    setDateFrom('')
    setDateTo('')
    router.push('/transactions')
    fetchData({ page: 1, q: '', status: '', branchId: '', dateFrom: '', dateTo: '' })
  }

  function handlePageChange(newPage: number) {
    const params = pushUrl({ page: newPage })
    fetchData(params)
  }

  function openVoidModal(row: TransactionRow) {
    setVoidModal({ trxNumber: row.trxNumber, trxId: row.id })
    setVoidReason('')
    setVoidError(null)
  }

  function closeVoidModal() {
    setVoidModal(null)
    setVoidReason('')
    setVoidError(null)
  }

  async function handleSubmitVoid() {
    if (!voidModal) return
    if (!voidReason.trim()) {
      setVoidError('Alasan void wajib diisi')
      return
    }
    setVoidLoading(true)
    setVoidError(null)
    try {
      const res = await fetch(`/api/bo/transactions/${voidModal.trxNumber}/void-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setVoidError(json.error ?? 'Gagal mengajukan void')
        return
      }
      setData(prev => prev.map(r =>
        r.id === voidModal.trxId ? { ...r, status: 'PENDING_VOID' } : r
      ))
      setSuccessMsg(`Pengajuan void ${voidModal.trxNumber} berhasil dikirim`)
      closeVoidModal()
    } catch {
      setVoidError('Terjadi kesalahan jaringan')
    } finally {
      setVoidLoading(false)
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

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">No. Transaksi</label>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApply()}
              placeholder="Cari nomor transaksi..."
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
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">No. Transaksi</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Tanggal</th>
                {isPrivileged && (
                  <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cabang</th>
                )}
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Kasir</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Metode Bayar</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-right">Total</th>
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
                    Tidak ada transaksi yang ditemukan.
                  </td>
                </tr>
              )}
              {!loading && data.map(row => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-primary font-medium">
                    {row.trxNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </td>
                  {isPrivileged && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                      {row.branchName}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {row.cashierName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {row.customerName ?? <span className="italic">Umum</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {row.paymentMethods}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums font-medium text-foreground">
                    {formatRupiah(row.payableAmount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => openVoidModal(row)}
                        className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
                      >
                        Ajukan Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
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

      {/* Modal Void */}
      {voidModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Ajukan Void Transaksi</h3>
              <button
                type="button"
                onClick={closeVoidModal}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Transaksi <span className="font-mono font-medium text-foreground">{voidModal.trxNumber}</span> akan diajukan untuk dibatalkan.
              </p>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Alasan Void <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  rows={3}
                  placeholder="Tuliskan alasan pengajuan void..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              {voidError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
                >
                  {voidError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={closeVoidModal}
                disabled={voidLoading}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitVoid}
                disabled={voidLoading}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {voidLoading ? 'Mengirim...' : 'Ajukan Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
