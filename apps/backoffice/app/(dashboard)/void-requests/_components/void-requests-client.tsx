'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react'

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface VoidRequestRow {
  id: number
  status: RequestStatus
  reason: string
  createdAt: string
  updatedAt: string
  transactionId: number
  trxNumber: string
  transactionStatus: string
  payableAmount: number
  transactionDate: string
  branchId: number
  branchName: string
  requestByName: string
  shiftSettled: boolean
}

const TABS: { value: RequestStatus; label: string }[] = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
]

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function VoidRequestsClient() {
  const [tab, setTab] = useState<RequestStatus>('PENDING')
  const [rows, setRows] = useState<VoidRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [warningMsg, setWarningMsg] = useState<string | null>(null)

  const [approveModal, setApproveModal] = useState<VoidRequestRow | null>(null)
  const [rejectModal, setRejectModal] = useState<VoidRequestRow | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async (status: RequestStatus) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/void-requests?status=${status}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'Gagal mengambil daftar pengajuan void')
      }
      setRows(data as VoidRequestRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengambil daftar pengajuan void')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(tab)
  }, [tab, load])

  async function handleApprove() {
    if (!approveModal) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/bo/void-requests/${approveModal.id}/approve`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'Gagal menyetujui pengajuan void')
      }
      setSuccessMsg(`Void ${data.trxNumber} disetujui — stok dikembalikan & transaksi dibatalkan.`)
      setWarningMsg(data.warning ?? null)
      setApproveModal(null)
      load(tab)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal menyetujui pengajuan void')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject() {
    if (!rejectModal) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/bo/void-requests/${rejectModal.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rejectNote.trim() ? { note: rejectNote.trim() } : {}),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'Gagal menolak pengajuan void')
      }
      setSuccessMsg(`Pengajuan void ${data.trxNumber} ditolak — transaksi kembali dihitung normal.`)
      setWarningMsg(null)
      setRejectModal(null)
      setRejectNote('')
      load(tab)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal menolak pengajuan void')
    } finally {
      setActionLoading(false)
    }
  }

  function closeModals() {
    if (actionLoading) return
    setApproveModal(null)
    setRejectModal(null)
    setRejectNote('')
    setActionError(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Persetujuan Void</h1>
          <p className="text-sm text-muted-foreground">
            Tinjau pengajuan pembatalan transaksi dari kasir/manajer
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-md text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {warningMsg && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-md text-sm bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{warningMsg}</span>
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setTab(t.value); setSuccessMsg(null); setWarningMsg(null) }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Memuat...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          {tab === 'PENDING'
            ? 'Tidak ada pengajuan void yang menunggu persetujuan.'
            : 'Tidak ada data.'}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">{row.trxNumber}</span>
                    <span className="font-bold text-foreground">{formatRupiah(row.payableAmount)}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {row.branchName}
                    </span>
                    {row.shiftSettled && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        Shift sudah settle
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">
                    <span className="text-muted-foreground">Alasan:</span> {row.reason}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3" />
                      Diajukan {formatDateTime(row.createdAt)}
                    </span>
                    <span>Oleh: {row.requestByName}</span>
                    <span>Transaksi: {formatDateTime(row.transactionDate)}</span>
                    {tab !== 'PENDING' && <span>Diproses {formatDateTime(row.updatedAt)}</span>}
                  </div>
                </div>

                {tab === 'PENDING' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => { setRejectModal(row); setActionError(null) }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => { setApproveModal(row); setActionError(null) }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Setujui
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Setujui */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Setujui Void Transaksi</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Transaksi{' '}
                <span className="font-mono font-medium text-foreground">{approveModal.trxNumber}</span>{' '}
                ({formatRupiah(approveModal.payableAmount)}) akan dibatalkan permanen. Stok
                dikembalikan dan transaksi keluar dari laporan penjualan.
              </p>
              {approveModal.shiftSettled && (
                <div className="px-3 py-2 rounded-md text-sm bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                  <span className="font-semibold">Perhatian:</span> shift transaksi ini sudah
                  di-settle. Uang yang dikembalikan ke pelanggan{' '}
                  <span className="font-semibold">tidak tercatat otomatis</span> — catat
                  pengeluarannya secara manual di{' '}
                  <span className="font-semibold">Keuangan &rarr; Pendapatan &amp; Pengeluaran</span>.
                </div>
              )}
              {actionError && (
                <div role="alert" className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                  {actionError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={closeModals}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Memproses...' : 'Ya, Void Transaksi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">Tolak Pengajuan Void</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Pengajuan void untuk{' '}
                <span className="font-mono font-medium text-foreground">{rejectModal.trxNumber}</span>{' '}
                akan ditolak. Transaksi kembali berstatus normal dan dihitung dalam laporan.
              </p>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Catatan (opsional)
                </label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Alasan penolakan..."
                  className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              {actionError && (
                <div role="alert" className="px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                  {actionError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={closeModals}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Memproses...' : 'Tolak Pengajuan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
