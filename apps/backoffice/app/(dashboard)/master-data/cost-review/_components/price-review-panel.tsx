'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PriceReviewEntry, PriceReviewLine } from '@/lib/services/price-review-service'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'

interface BranchOption {
  id: number
  name: string
}

const SOURCE_LABELS: Record<string, string> = {
  PO_RECEIVING: 'Terima PO',
  PO_INVOICE: 'Faktur PO',
  IBT_RECEIVE: 'Terima transfer internal',
  STOCK_ADJUSTMENT: 'Penambahan stok',
}

const TIER_LABELS: Record<string, string> = {
  RETAIL: 'Retail',
  RESELLER: 'Reseller',
  GROSIR: 'Grosir',
  MEMBER: 'Member',
  DISTRIBUTOR: 'Distributor',
  PROMO: 'Promo',
}

const rupiah = (n: number) => n.toLocaleString('id-ID')
const lineKey = (l: { uomId: number; tierType: string }) => `${l.uomId}:${l.tierType}`

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function MarginText({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-muted-foreground">—</span>
  const tone = percent <= 0 ? 'text-destructive font-semibold' : percent < 10 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
  return <span className={tone}>{percent.toLocaleString('id-ID')}%</span>
}

type Decision = { kind: 'keep' | 'reject'; review: PriceReviewEntry }

/**
 * Tab Harga Jual (spec 2026-11-10 periksa harga jual, Tahap 2): barang yang modalnya naik wajib
 * diperiksa Owner/GM. Setujui menulis harga ke Manajemen Harga; modal yang masih ditahan ikut disetujui.
 */
export default function PriceReviewPanel({
  initialReviews,
  branches,
  onCountChange,
}: {
  initialReviews: PriceReviewEntry[]
  branches: BranchOption[]
  onCountChange: (count: number) => void
}) {
  const router = useRouter()
  const [reviews, setReviews] = useState(initialReviews)
  const [branchId, setBranchId] = useState('')
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busyId, setBusyId] = useState<number | 'bulk' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const firstLoad = useRef(true)

  async function reload(nextBranch = branchId) {
    try {
      const res = await fetch(`/api/bo/price-reviews${nextBranch ? `?branchId=${nextBranch}` : ''}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal memuat daftar')
        return
      }
      setReviews(data)
      setSelected(prev => new Set([...prev].filter(id => (data as PriceReviewEntry[]).some(r => r.id === id))))
      if (!nextBranch) onCountChange(data.length)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    }
  }

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }
    void reload(branchId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  const priceOf = (review: PriceReviewEntry, line: PriceReviewLine) => {
    const typed = edits[review.id]?.[lineKey(line)]
    return typed === undefined ? line.suggested : Number(typed || 0)
  }

  const belowCost = (review: PriceReviewEntry) =>
    review.lines.filter(l => l.unitCost !== null && priceOf(review, l) < l.unitCost)

  function setEdit(reviewId: number, key: string, value: string) {
    setEdits(prev => ({ ...prev, [reviewId]: { ...prev[reviewId], [key]: digitsOnly(value) } }))
  }

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data }
  }

  async function afterChange(message: string) {
    setSuccess(message)
    await reload()
    router.refresh()
  }

  async function approve(review: PriceReviewEntry) {
    setError(null)
    setSuccess(null)
    const below = belowCost(review)
    if (below.length > 0) {
      setError(`${review.productName}: ada harga di bawah modal baru — naikkan dulu.`)
      return
    }
    setBusyId(review.id)
    try {
      const { ok, data } = await post(`/api/bo/price-reviews/${review.id}/approve`, {
        prices: review.lines.map(l => ({ uomId: l.uomId, tierType: l.tierType, price: priceOf(review, l) })),
      })
      if (!ok) {
        setError(data.error ?? 'Gagal menyetujui')
        return
      }
      await afterChange(`${review.productName}: harga jual diperbarui di Manajemen Harga.`)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusyId(null)
    }
  }

  async function approveSelected() {
    setError(null)
    setSuccess(null)
    setBusyId('bulk')
    try {
      const { ok, data } = await post('/api/bo/price-reviews/approve-bulk', { ids: [...selected] })
      if (!ok) {
        setError(data.error ?? 'Gagal menyetujui')
        return
      }
      setSelected(new Set())
      const failed = (data.failed ?? []) as { id: number; error: string }[]
      if (failed.length > 0) setError(`Gagal ${failed.length} barang: ${failed.map(f => f.error).join('; ')}`)
      await afterChange(`${data.approved} barang disetujui dengan harga usulan.`)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusyId(null)
    }
  }

  async function submitDecision() {
    if (!decision) return
    if (!reason.trim()) {
      setError('Alasan wajib diisi')
      return
    }
    setError(null)
    setBusyId(decision.review.id)
    try {
      const path = decision.kind === 'keep' ? 'keep' : 'reject-cost'
      const { ok, data } = await post(`/api/bo/price-reviews/${decision.review.id}/${path}`, { reason: reason.trim() })
      if (!ok) {
        setError(data.error ?? 'Gagal menyimpan keputusan')
        return
      }
      const name = decision.review.productName
      setDecision(null)
      setReason('')
      await afterChange(decision.kind === 'keep' ? `${name}: harga lama dipertahankan.` : `${name}: kenaikan modal ditolak, modal tetap.`)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusyId(null)
    }
  }

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Barang yang modalnya naik dari barang masuk. Usulan harga mempertahankan persentase untung lama dan dibulatkan
        ke atas ke Rp 100. <b className="text-foreground">Setujui</b> langsung mengubah harga di Manajemen Harga cabang
        itu; modal yang masih ditahan (naik ≥ 30%) ikut disetujui. Selama belum diperiksa, kasir menolak harga yang di
        bawah modal.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background"
          aria-label="Saring cabang"
        >
          <option value="">Semua cabang</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={approveSelected}
          disabled={selected.size === 0 || busyId !== null}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busyId === 'bulk' ? 'Menyimpan...' : `Setujui harga usulan (${selected.size} terpilih)`}
        </button>
      </div>

      {success && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">{success}</div>}
      {error && <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}

      {reviews.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          Tidak ada harga jual yang perlu diperiksa.
        </div>
      ) : (
        reviews.map(review => {
          const below = belowCost(review)
          const busy = busyId === review.id || busyId === 'bulk'
          return (
            <div key={review.id} className="bg-card rounded-lg border border-border shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(review.id)}
                    onChange={() => toggle(review.id)}
                    disabled={busy}
                    className="mt-1 w-4 h-4"
                    aria-label={`Pilih ${review.productName}`}
                  />
                  <span>
                    <span className="font-semibold text-foreground">{review.productName}</span>
                    {review.sku && <span className="ml-2 text-xs text-muted-foreground">SKU {review.sku}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {review.branchName} ·{' '}
                      {review.sources.map(s => `${SOURCE_LABELS[s.type] ?? s.type}${s.ref ? ` ${s.ref}` : ''}`).join(', ')} ·{' '}
                      {formatDate(review.updatedAt)}
                    </span>
                  </span>
                </label>
                <div className="text-right text-sm">
                  <div>
                    Modal per {review.baseUomCode ?? 'satuan dasar'}:{' '}
                    {review.oldCostPerBase !== null ? rupiah(review.oldCostPerBase) : '—'} →{' '}
                    <b className="text-foreground">{rupiah(review.newCostPerBase)}</b>
                    {review.changePercent !== null && (
                      <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-destructive/10 text-destructive">
                        +{review.changePercent.toLocaleString('id-ID')}%
                      </span>
                    )}
                  </div>
                  {review.costPending && (
                    <div className="text-xs text-amber-700 dark:text-amber-400">Modal baru masih ditahan — ikut disetujui bersama harga jual</div>
                  )}
                </div>
              </div>

              {review.lines.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  Belum ada harga jual di cabang ini. Setujui untuk mencatat bahwa modal sudah diperiksa, lalu isi harga di
                  Manajemen Harga.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-2">Satuan</th>
                        <th className="text-left px-4 py-2">Jenis harga</th>
                        <th className="text-right px-4 py-2">Harga lama</th>
                        <th className="text-right px-4 py-2">Modal baru</th>
                        <th className="text-right px-4 py-2">Margin lama thd modal baru</th>
                        <th className="text-right px-4 py-2">Usulan</th>
                        <th className="text-right px-4 py-2 w-40">Harga baru</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {review.lines.map(line => {
                        const price = priceOf(review, line)
                        const lineBelow = line.unitCost !== null && price < line.unitCost
                        return (
                          <tr key={lineKey(line)}>
                            <td className="px-4 py-2">{line.uomCode ?? '-'}</td>
                            <td className="px-4 py-2">{TIER_LABELS[line.tierType] ?? line.tierType}</td>
                            <td className="px-4 py-2 text-right">{rupiah(line.price)}</td>
                            <td className="px-4 py-2 text-right">{line.unitCost !== null ? rupiah(line.unitCost) : '—'}</td>
                            <td className="px-4 py-2 text-right"><MarginText percent={line.marginPercent} /></td>
                            <td className="px-4 py-2 text-right">{rupiah(line.suggested)}</td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={formatRupiahInput(edits[review.id]?.[lineKey(line)] ?? String(line.suggested))}
                                onChange={e => setEdit(review.id, lineKey(line), e.target.value)}
                                disabled={busy}
                                aria-label={`Harga baru ${line.uomCode ?? ''} ${line.tierType}`}
                                className={`w-full border rounded px-2 py-1 text-right bg-background ${lineBelow ? 'border-destructive text-destructive' : 'border-input'}`}
                              />
                              {lineBelow && <div className="text-[11px] text-destructive text-right">di bawah modal</div>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-border">
                {review.costPending && (
                  <button
                    type="button"
                    onClick={() => { setDecision({ kind: 'reject', review }); setReason(''); setError(null) }}
                    disabled={busy}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Tolak kenaikan modal
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setDecision({ kind: 'keep', review }); setReason(''); setError(null) }}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent disabled:opacity-50"
                >
                  Tetap harga lama
                </button>
                <button
                  type="button"
                  onClick={() => approve(review)}
                  disabled={busy || below.length > 0}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busyId === review.id ? 'Menyimpan...' : 'Setujui harga'}
                </button>
              </div>
            </div>
          )
        })
      )}

      {decision && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" role="presentation" onClick={() => setDecision(null)} />
          <div className="fixed inset-x-4 top-8 z-50 mx-auto max-w-lg rounded-2xl bg-background shadow-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {decision.kind === 'keep' ? 'Tetap Pakai Harga Lama' : 'Tolak Kenaikan Modal'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {decision.review.productName} · {decision.review.branchName}
              <br />
              {decision.kind === 'keep'
                ? 'Harga jual tidak berubah. Ditolak bila ada harga yang di bawah modal baru.'
                : 'Modal di Manajemen Harga tidak berubah dan pemeriksaan ini ditutup.'}
            </p>
            <label className="block text-sm font-medium text-foreground mb-1">Alasan (wajib)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background resize-none"
            />
            {error && <div className="mt-3 bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">{error}</div>}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={submitDecision}
                disabled={busyId !== null}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busyId !== null ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setDecision(null)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent"
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
