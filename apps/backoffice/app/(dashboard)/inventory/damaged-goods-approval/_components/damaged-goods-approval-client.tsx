'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DamagedGoodsQueueEntry, DamagedGoodsQueueStatus } from '@/lib/services/damaged-goods-approval'

const REASON_LABELS: Record<string, string> = {
  RUSAK: 'Rusak',
  EXPIRED: 'Kadaluarsa',
  HILANG: 'Hilang',
}

const RESOLUTION_LABELS: Record<string, string> = {
  MUSNAHKAN: 'Musnahkan',
  RETUR_SUPPLIER: 'Retur ke Supplier',
  JUAL_DISKON: 'Jual Diskon',
  LAINNYA: 'Lainnya',
}

const RESOLUTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'MUSNAHKAN', label: 'Musnahkan' },
  { value: 'RETUR_SUPPLIER', label: 'Retur ke Supplier' },
  { value: 'JUAL_DISKON', label: 'Jual Diskon' },
  { value: 'LAINNYA', label: 'Lainnya' },
]

const TABS: { value: DamagedGoodsQueueStatus; label: string }[] = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
]

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
  } catch {
    return iso
  }
}

interface Props {
  initialRows: DamagedGoodsQueueEntry[]
}

export default function DamagedGoodsApprovalClient({ initialRows }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<DamagedGoodsQueueStatus>('PENDING')
  const [rows, setRows] = useState<DamagedGoodsQueueEntry[]>(initialRows)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<DamagedGoodsQueueEntry | null>(null)
  const [rejectTarget, setRejectTarget] = useState<DamagedGoodsQueueEntry | null>(null)
  const [resolutionAction, setResolutionAction] = useState('MUSNAHKAN')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = useCallback(async (status: DamagedGoodsQueueStatus) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/bo/damaged-goods/queue?status=${status}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error ?? 'Gagal memuat daftar')
        return
      }
      setRows(Array.isArray(data) ? data : [])
    } catch {
      setLoadError('Terjadi kesalahan jaringan')
    } finally {
      setLoading(false)
    }
  }, [])

  // Tab PENDING sudah dibawa dari server render pertama — tidak perlu fetch ulang saat mount.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    load(tab)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  function openApprove(row: DamagedGoodsQueueEntry) {
    setApproveTarget(row)
    setResolutionAction('MUSNAHKAN')
    setResolutionNotes('')
    setModalError(null)
  }

  function openReject(row: DamagedGoodsQueueEntry) {
    setRejectTarget(row)
    setRejectionReason('')
    setModalError(null)
  }

  async function submitApprove() {
    if (!approveTarget) return
    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/bo/damaged-goods/${approveTarget.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionAction, resolutionNotes: resolutionNotes.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setModalError(data.error ?? `Gagal approve (${res.status})`)
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== approveTarget.id))
      setSuccessMsg(`Laporan #${approveTarget.id} (${approveTarget.branchName}) disetujui — stok sudah dipotong.`)
      setApproveTarget(null)
      router.refresh()
    } catch {
      setModalError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReject() {
    if (!rejectTarget) return
    if (!rejectionReason.trim()) {
      setModalError('Alasan penolakan wajib diisi')
      return
    }
    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/bo/damaged-goods/${rejectTarget.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setModalError(data.error ?? `Gagal menolak (${res.status})`)
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== rejectTarget.id))
      setSuccessMsg(`Laporan #${rejectTarget.id} (${rejectTarget.branchName}) ditolak.`)
      setRejectTarget(null)
      router.refresh()
    } catch {
      setModalError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setTab(t.value); setSuccessMsg(null) }}
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

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {loadError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted-foreground shadow-xs">
          Memuat...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted-foreground shadow-xs">
          {tab === 'PENDING' ? 'Tidak ada laporan barang rusak yang menunggu approval.' : 'Belum ada riwayat.'}
        </div>
      ) : (
        rows.map((row) => (
          <div key={row.id} className="bg-card rounded-lg border border-border shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      row.status === 'PENDING'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : row.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {row.status === 'PENDING' ? 'PENDING' : row.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK'}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 text-xs font-semibold">
                    {REASON_LABELS[row.reason] ?? row.reason}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">{row.branchName}</p>
                <p className="text-xs text-muted-foreground">
                  Dilaporkan {row.reportedByName} &middot; {formatDateTime(row.reportedAt)}
                </p>
                {row.status !== 'PENDING' && row.resolvedAt && (
                  <p className="text-xs text-muted-foreground">
                    {row.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'} {row.resolvedByName ?? '-'} &middot; {formatDateTime(row.resolvedAt)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {row.status === 'PENDING' ? 'Estimasi Kerugian' : 'Kerugian'}
                </p>
                <p className="text-lg font-bold text-destructive">{formatRupiah(row.totalLossValue)}</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-2">
              {row.items.map((item, idx: number) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  {item.photoUrl ? (
                    <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img
                        src={item.photoUrl}
                        alt={`Foto ${item.productName}`}
                        className="w-12 h-12 object-cover rounded-md border border-border"
                      />
                    </a>
                  ) : (
                    <div className="w-12 h-12 flex-shrink-0 rounded-md border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">
                      no foto
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{item.productName}</p>
                    {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                  </div>
                  <span className="text-muted-foreground whitespace-nowrap">{item.qty} {item.uomCode}</span>
                  <span className="font-semibold text-destructive whitespace-nowrap">{formatRupiah(item.lossValue)}</span>
                </div>
              ))}
              {row.notes && (
                <p className="text-xs italic text-muted-foreground pt-1">&ldquo;{row.notes}&rdquo;</p>
              )}
              {row.status === 'APPROVED' && row.resolutionAction && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 pt-1">
                  Tindak lanjut: <span className="font-semibold">{RESOLUTION_LABELS[row.resolutionAction] ?? row.resolutionAction}</span>
                  {row.resolutionNotes && <> — {row.resolutionNotes}</>}
                </p>
              )}
              {row.status === 'REJECTED' && row.rejectionReason && (
                <p className="text-xs text-destructive pt-1">Alasan ditolak: {row.rejectionReason}</p>
              )}
            </div>

            {row.status === 'PENDING' && (
              <div className="px-5 py-3 border-t border-border bg-muted/20 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openReject(row)}
                  className="px-4 py-2 text-sm font-medium text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => openApprove(row)}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {approveTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" role="presentation" onClick={() => setApproveTarget(null)} />
          <div className="fixed inset-x-4 top-8 z-50 mx-auto max-w-lg rounded-2xl bg-background shadow-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">Approve Laporan #{approveTarget.id}</h2>
              <button type="button" onClick={() => setApproveTarget(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {approveTarget.branchName} &middot; stok akan langsung dipotong dengan nilai FIFO saat ini.
            </p>

            {modalError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm mb-3">
                {modalError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tindak Lanjut</label>
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setResolutionAction(opt.value)}
                      className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                        resolutionAction === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Catatan (opsional)</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
                  placeholder="Detail tindak lanjut..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={submitApprove}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Menyimpan...' : 'Approve & Potong Stok'}
              </button>
              <button
                type="button"
                onClick={() => setApproveTarget(null)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </>
      )}

      {rejectTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" role="presentation" onClick={() => setRejectTarget(null)} />
          <div className="fixed inset-x-4 top-8 z-50 mx-auto max-w-lg rounded-2xl bg-background shadow-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">Tolak Laporan #{rejectTarget.id}</h2>
              <button type="button" onClick={() => setRejectTarget(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {rejectTarget.branchName} &middot; stok tidak pernah tersentuh, jadi tidak ada yang perlu dikembalikan.
            </p>

            {modalError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm mb-3">
                {modalError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Alasan</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Kenapa laporan ini ditolak..."
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={submitReject}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Menyimpan...' : 'Tolak Laporan'}
              </button>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
