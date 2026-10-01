'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type {
  CostReviewEntry,
  CostReviewTab,
  CostSyncSourceType,
  MarginAlertEntry,
} from '@/lib/services/cost-sync-service'

type View = 'MODAL' | 'MARGIN'

interface BranchOption {
  id: number
  name: string
}

const REVIEW_TABS: { value: CostReviewTab; label: string }[] = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'APPLIED', label: 'Otomatis' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak / Digantikan' },
]

const SOURCE_LABELS: Record<CostSyncSourceType, string> = {
  PO_RECEIVING: 'Terima PO',
  PO_INVOICE: 'Koreksi faktur PO',
  IBT_RECEIVE: 'Terima transfer internal',
  STOCK_ADJUSTMENT: 'Penambahan stok',
  PO_REVERSAL: 'Batal terima PO',
}

const TIER_LABELS: Record<string, string> = {
  RETAIL: 'Retail',
  RESELLER: 'Reseller',
  GROSIR: 'Grosir',
  MEMBER: 'Member',
}

function formatNumber(value: number): string {
  return value.toLocaleString('id-ID')
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function ChangeBadge({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-xs text-muted-foreground">modal baru</span>
  }
  const big = Math.abs(percent) >= 30
  const tone = percent > 0
    ? big ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
    : big ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {percent > 0 ? '+' : ''}{percent.toLocaleString('id-ID')}%
    </span>
  )
}

interface Props {
  initialReviews: CostReviewEntry[]
  branches: BranchOption[]
}

export default function CostReviewClient({ initialReviews, branches }: Props) {
  const router = useRouter()
  const [view, setView] = useState<View>('MODAL')

  const [tab, setTab] = useState<CostReviewTab>('PENDING')
  const [reviews, setReviews] = useState<CostReviewEntry[]>(initialReviews)
  const [pendingCount, setPendingCount] = useState(initialReviews.length)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [approveTarget, setApproveTarget] = useState<CostReviewEntry | null>(null)
  const [rejectTarget, setRejectTarget] = useState<CostReviewEntry | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [marginBranch, setMarginBranch] = useState('')
  const [marginSearch, setMarginSearch] = useState('')
  const [margins, setMargins] = useState<MarginAlertEntry[] | null>(null)
  const [marginTotal, setMarginTotal] = useState(0)
  const [marginLoading, setMarginLoading] = useState(false)
  const [marginError, setMarginError] = useState<string | null>(null)

  const loadReviews = useCallback(async (t: CostReviewTab) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/bo/cost-reviews?tab=${t}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError(data.error ?? 'Gagal memuat daftar')
        return
      }
      const rows: CostReviewEntry[] = Array.isArray(data) ? data : []
      setReviews(rows)
      if (t === 'PENDING') setPendingCount(rows.length)
    } catch {
      setLoadError('Terjadi kesalahan jaringan')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMargins = useCallback(async (branchId: string, q: string) => {
    setMarginLoading(true)
    setMarginError(null)
    try {
      const params = new URLSearchParams()
      if (branchId) params.set('branchId', branchId)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/bo/cost-reviews/margins?${params}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMarginError(data.error ?? 'Gagal memuat daftar margin')
        return
      }
      setMargins(Array.isArray(data.items) ? data.items : [])
      setMarginTotal(Number(data.total ?? 0))
    } catch {
      setMarginError('Terjadi kesalahan jaringan')
    } finally {
      setMarginLoading(false)
    }
  }, [])

  // Tab Menunggu sudah dibawa dari render server pertama.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    loadReviews(tab)
  }, [tab, loadReviews])

  useEffect(() => {
    if (view === 'MARGIN' && margins === null) loadMargins(marginBranch, marginSearch)
  }, [view, margins, marginBranch, marginSearch, loadMargins])

  function openApprove(row: CostReviewEntry) {
    setApproveTarget(row)
    setNote('')
    setModalError(null)
  }

  function openReject(row: CostReviewEntry) {
    setRejectTarget(row)
    setNote('')
    setModalError(null)
  }

  async function submitDecision(kind: 'approve' | 'reject') {
    const target = kind === 'approve' ? approveTarget : rejectTarget
    if (!target) return
    if (kind === 'reject' && !note.trim()) {
      setModalError('Alasan penolakan wajib diisi')
      return
    }
    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/bo/cost-reviews/${target.id}/${kind}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'approve' ? { note: note.trim() || undefined } : { reason: note.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setModalError(data.error ?? `Gagal menyimpan (${res.status})`)
        return
      }
      setReviews((prev) => prev.filter((r) => r.id !== target.id))
      setPendingCount((n) => Math.max(0, n - 1))
      setSuccessMsg(
        kind === 'approve'
          ? `Modal ${target.productName} (${target.branchName}) diperbarui ke ${formatNumber(target.newCostPerBase)}/${target.baseUomCode ?? 'satuan dasar'}.`
          : `Usulan modal ${target.productName} (${target.branchName}) ditolak — modal tidak berubah.`,
      )
      setApproveTarget(null)
      setRejectTarget(null)
      // Modal berubah bisa memunculkan/menghilangkan baris margin
      setMargins(null)
      router.refresh()
    } catch {
      setModalError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  const modalTarget = approveTarget ?? rejectTarget

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([
          { value: 'MODAL' as const, label: `Modal Perlu Ditinjau${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { value: 'MARGIN' as const, label: `Margin Menipis / Rugi${margins !== null ? ` (${marginTotal})` : ''}` },
        ]).map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => { setView(v.value); setSuccessMsg(null) }}
            className={`px-4 py-2 text-sm font-semibold rounded-md border transition-colors ${
              view === v.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {view === 'MODAL' ? (
        <>
          <div className="flex gap-1 border-b border-border">
            {REVIEW_TABS.map((t) => (
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

          {loadError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {loadError}
            </div>
          )}

          <div className="bg-card rounded-lg border border-border shadow-xs overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>
            ) : reviews.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {tab === 'PENDING' ? 'Tidak ada perubahan modal yang menunggu persetujuan.' : 'Belum ada riwayat.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground border-b border-border text-[10px] uppercase tracking-widest">
                    <th className="text-left px-4 py-3 font-bold">Produk</th>
                    <th className="text-left px-3 py-3 font-bold">Cabang</th>
                    <th className="text-left px-3 py-3 font-bold">Sumber</th>
                    <th className="text-right px-3 py-3 font-bold">Modal Lama</th>
                    <th className="text-right px-3 py-3 font-bold">Modal Baru</th>
                    <th className="text-right px-3 py-3 font-bold">Perubahan</th>
                    <th className="text-right px-4 py-3 font-bold">{tab === 'PENDING' ? 'Aksi' : 'Keputusan'}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{r.productName}</p>
                        {r.sku && <p className="text-xs text-muted-foreground">SKU: {r.sku}</p>}
                      </td>
                      <td className="px-3 py-3 text-foreground whitespace-nowrap">{r.branchName}</td>
                      <td className="px-3 py-3">
                        <p className="text-foreground">{SOURCE_LABELS[r.sourceType] ?? r.sourceType}</p>
                        <p className="text-xs text-muted-foreground">{r.sourceRef ?? '-'}</p>
                        {r.sourceType !== 'PO_REVERSAL' && (
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(r.sourceUnitCost)} / {r.sourceUomCode ?? '-'}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground whitespace-nowrap">
                        {r.oldCostPerBase !== null ? formatNumber(r.oldCostPerBase) : '—'}
                        <span className="text-xs"> /{r.baseUomCode ?? ''}</span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        {formatNumber(r.newCostPerBase)}
                        <span className="text-xs font-normal text-muted-foreground"> /{r.baseUomCode ?? ''}</span>
                      </td>
                      <td className="px-3 py-3 text-right"><ChangeBadge percent={r.changePercent} /></td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openReject(r)}
                              className="px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
                            >
                              Tolak
                            </button>
                            <button
                              type="button"
                              onClick={() => openApprove(r)}
                              className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                              Setujui
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {r.status === 'APPLIED' && <p>Diterapkan otomatis{r.createdByName ? ` · ${r.createdByName}` : ''}</p>}
                            {r.status === 'APPROVED' && <p>Disetujui {r.resolvedByName ?? '-'}</p>}
                            {r.status === 'REJECTED' && <p className="text-destructive">Ditolak {r.resolvedByName ?? '-'}</p>}
                            {r.status === 'SUPERSEDED' && <p>Digantikan</p>}
                            {r.resolvedAt && <p>{formatDateTime(r.resolvedAt)}</p>}
                            {r.resolutionNote && <p className="italic">&ldquo;{r.resolutionNote}&rdquo;</p>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={(e) => { e.preventDefault(); loadMargins(marginBranch, marginSearch) }}
          >
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cabang</label>
              <select
                value={marginBranch}
                onChange={(e) => { setMarginBranch(e.target.value); loadMargins(e.target.value, marginSearch) }}
                className="border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Semua cabang</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cari produk</label>
              <input
                value={marginSearch}
                onChange={(e) => setMarginSearch(e.target.value)}
                placeholder="Nama atau SKU..."
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
            <button type="submit" className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors">
              Cari
            </button>
          </form>

          {marginError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {marginError}
            </div>
          )}

          <div className="bg-card rounded-lg border border-border shadow-xs overflow-x-auto">
            {marginLoading || margins === null ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>
            ) : margins.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Tidak ada harga jual dengan margin 1% atau kurang.
              </div>
            ) : (
              <>
                {marginTotal > margins.length && (
                  <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                    Menampilkan {margins.length} dari {marginTotal} baris dengan margin terendah — persempit dengan filter cabang/pencarian.
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground border-b border-border text-[10px] uppercase tracking-widest">
                      <th className="text-left px-4 py-3 font-bold">Produk</th>
                      <th className="text-left px-3 py-3 font-bold">Cabang</th>
                      <th className="text-left px-3 py-3 font-bold">Satuan</th>
                      <th className="text-left px-3 py-3 font-bold">Tier</th>
                      <th className="text-right px-3 py-3 font-bold">Harga Jual</th>
                      <th className="text-right px-3 py-3 font-bold">Modal</th>
                      <th className="text-right px-3 py-3 font-bold">Margin</th>
                      <th className="text-right px-4 py-3 font-bold" />
                    </tr>
                  </thead>
                  <tbody>
                    {margins.map((m) => {
                      const loss = m.margin <= 0
                      return (
                        <tr key={`${m.branchId}:${m.productId}:${m.uomId}:${m.tierType}`} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{m.productName}</p>
                            {m.sku && <p className="text-xs text-muted-foreground">SKU: {m.sku}</p>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{m.branchName}</td>
                          <td className="px-3 py-3">{m.uomCode}</td>
                          <td className="px-3 py-3">{TIER_LABELS[m.tierType] ?? m.tierType}</td>
                          <td className="px-3 py-3 text-right">{formatNumber(m.price)}</td>
                          <td className="px-3 py-3 text-right">{formatNumber(m.costPrice)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              loss ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            }`}>
                              {loss ? 'Rugi' : 'Menipis'} {formatNumber(m.margin)} ({m.marginPercent.toLocaleString('id-ID')}%)
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/master-data/prices?${new URLSearchParams({ branchId: String(m.branchId), q: m.productName })}`}
                              className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                            >
                              Atur Harga
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}

      {modalTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            role="presentation"
            onClick={() => { setApproveTarget(null); setRejectTarget(null) }}
          />
          <div className="fixed inset-x-4 top-8 z-50 mx-auto max-w-lg rounded-2xl bg-background shadow-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">
                {approveTarget ? 'Setujui Perubahan Modal' : 'Tolak Perubahan Modal'}
              </h2>
              <button
                type="button"
                onClick={() => { setApproveTarget(null); setRejectTarget(null) }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {modalTarget.productName} · {modalTarget.branchName}
              <br />
              Modal per {modalTarget.baseUomCode ?? 'satuan dasar'}:{' '}
              {modalTarget.oldCostPerBase !== null ? formatNumber(modalTarget.oldCostPerBase) : '—'} →{' '}
              <span className="font-semibold text-foreground">{formatNumber(modalTarget.newCostPerBase)}</span>
              {approveTarget
                ? '. Semua satuan produk ini ikut diperbarui dari rasio konversi.'
                : '. Modal di Manajemen Harga tidak akan berubah.'}
            </p>

            {modalError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm mb-3">
                {modalError}
              </div>
            )}

            <label className="block text-sm font-medium text-foreground mb-1">
              {approveTarget ? 'Catatan (opsional)' : 'Alasan'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={approveTarget ? 'Mis. harga supplier memang naik' : 'Kenapa perubahan ini ditolak...'}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
            />

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => submitDecision(approveTarget ? 'approve' : 'reject')}
                disabled={submitting}
                className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 transition-colors ${
                  approveTarget
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                }`}
              >
                {submitting ? 'Menyimpan...' : approveTarget ? 'Setujui & Perbarui Modal' : 'Tolak'}
              </button>
              <button
                type="button"
                onClick={() => { setApproveTarget(null); setRejectTarget(null) }}
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
