'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { clearSOFullDraft, readSOFullDraft, writeSOFullDraft, type SOFullDraftItems } from './so-full-draft-storage'

export interface CandidateItem {
  productId: number
  productName: string
  sku: string | null
  uomId: number
  uomCode: string
  systemQty: number
  liveSystemQty: number
  soItemId: number | null
  physicalQty: number | null
  varianceQty: number | null
  varianceCostValue: number | null
  varianceReason: string | null
  itemStatus: string | null
  isRecounted: boolean
  recountPhysicalQty: number | null
  recountVarianceQty: number | null
  decisionNote: string | null
}

interface ItemDraft {
  physicalQty: string
  varianceReason: string
}

interface Props {
  soId: number
  // Dipanggil setelah simpan/keputusan berhasil supaya so-client.tsx menyegarkan
  // kartu ringkasan (jumlah item, status header) & daftar SO di luar modal.
  onItemsChanged: () => void
}

// Nilai/handler yang dibawa ke `columns` lewat table.options.meta, bukan closure —
// drafts/itemRejectNote berubah tiap ketikan, dan closure di `columns` yang
// bergantung padanya akan membangun ulang fungsi cell tiap render, membuat
// flexRender me-remount input-nya (fokus hilang tiap karakter). Lihat komentar
// `meta` di components/ui/data-table.tsx.
interface CandidateTableMeta {
  drafts: Record<string, ItemDraft>
  saving: boolean
  decideProcessingId: number | null
  rejectingItemId: number | null
  itemRejectNote: string
  onDraftChange: (key: string, next: ItemDraft) => void
  onApprove: (itemId: number) => void
  onStartReject: (itemId: number) => void
  onCancelReject: () => void
  onChangeRejectNote: (value: string) => void
  onSubmitReject: (itemId: number, note: string) => void
}

function draftKey(productId: number, uomId: number) {
  return `${productId}:${uomId}`
}

function toDraft(candidate: CandidateItem): ItemDraft {
  return {
    physicalQty: candidate.soItemId !== null ? String(candidate.physicalQty) : '',
    varianceReason: candidate.varianceReason ?? '',
  }
}

// Beda dari isDraftDirty di so-client.tsx: baris yang belum pernah disentuh
// (physicalQty draft kosong) BUKAN dirty di sini — kalau dianggap dirty,
// ratusan kandidat yang belum diisi langsung memicu error validasi tampilan.
function isCandidateDirty(candidate: CandidateItem, draft: ItemDraft): boolean {
  if (draft.physicalQty.trim() === '') return false
  const qty = Number(draft.physicalQty)
  if (!Number.isInteger(qty) || qty < 0) return true
  if (candidate.soItemId === null) return true
  return qty !== candidate.physicalQty || draft.varianceReason.trim() !== (candidate.varianceReason ?? '')
}

function formatRupiah(value: number | null | undefined): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

const ITEM_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  MATCHED: { label: 'Cocok Otomatis', cls: 'bg-muted text-muted-foreground' },
  PENDING: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Ditolak', cls: 'bg-destructive/10 text-destructive' },
}

function ItemStatusBadge({ status }: { status: string | null }) {
  if (status === null) return <span className="text-xs text-muted-foreground">Belum dihitung</span>
  const badge = ITEM_STATUS_BADGE[status]
  if (!badge) return <span className="text-muted-foreground">-</span>
  return <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${badge.cls}`}>{badge.label}</span>
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function SOFullInputTable({ soId, onItemsChanged }: Props) {
  const [candidates, setCandidates] = useState<CandidateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({})
  const [search, setSearch] = useState('')
  const [onlyUnfilled, setOnlyUnfilled] = useState(false)
  const [pageSize, setPageSize] = useState(25)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [decideProcessingId, setDecideProcessingId] = useState<number | null>(null)
  const [rejectingItemId, setRejectingItemId] = useState<number | null>(null)
  const [itemRejectNote, setItemRejectNote] = useState('')
  const [decideError, setDecideError] = useState<string | null>(null)
  const [decideSuccess, setDecideSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/bo/stock-opnames/${soId}/candidates`)
        const data = await res.json()
        if (!res.ok) {
          if (!cancelled) setLoadError(data.error ?? `Gagal memuat daftar kandidat produk (${res.status})`)
          return
        }
        if (cancelled) return

        const fetched = data.items as CandidateItem[]
        setCandidates(fetched)

        const stored = readSOFullDraft(soId)
        const byKey = new Map(fetched.map((c) => [draftKey(c.productId, c.uomId), c]))
        const merged: Record<string, ItemDraft> = {}
        for (const [key, value] of Object.entries(stored)) {
          const candidate = byKey.get(key)
          // Draft utk baris yang sudah dikunci admin (APPROVED/REJECTED) dibuang —
          // sudah tidak relevan, input tetap terkunci di tabel.
          if (!candidate || candidate.itemStatus === 'APPROVED' || candidate.itemStatus === 'REJECTED') continue
          merged[key] = value
        }
        setDrafts(merged)
      } catch {
        if (!cancelled) setLoadError('Terjadi kesalahan jaringan, silakan coba lagi')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [soId])

  // Simpan draft dirty ke localStorage tiap kali berubah — reload sebelum sempat
  // "Simpan Koreksi" tidak akan menghapus qty fisik yang sudah diketik.
  useEffect(() => {
    if (loading) return
    const candidateByKey = new Map(candidates.map((c) => [draftKey(c.productId, c.uomId), c]))
    const dirtyOnly: SOFullDraftItems = {}
    for (const [key, draft] of Object.entries(drafts)) {
      const candidate = candidateByKey.get(key)
      if (candidate && isCandidateDirty(candidate, draft)) dirtyOnly[key] = draft
    }
    writeSOFullDraft(soId, dirtyOnly)
  }, [drafts, candidates, loading, soId])

  async function refreshCandidates() {
    setRefreshing(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/bo/stock-opnames/${soId}/candidates`)
      const data = await res.json()
      if (!res.ok) {
        setLoadError(data.error ?? `Gagal memuat stok terkini (${res.status})`)
        return
      }
      setCandidates(data.items as CandidateItem[])
    } catch {
      setLoadError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setRefreshing(false)
    }
  }

  const dirtyCandidates = useMemo(
    () =>
      candidates.filter((c) => {
        const draft = drafts[draftKey(c.productId, c.uomId)]
        return draft !== undefined && isCandidateDirty(c, draft)
      }),
    [candidates, drafts]
  )

  async function handleSave() {
    if (dirtyCandidates.length === 0) return

    const invalid = dirtyCandidates.find((c) => {
      const draft = drafts[draftKey(c.productId, c.uomId)]
      const qty = Number(draft.physicalQty)
      return !Number.isInteger(qty) || qty < 0
    })
    if (invalid) {
      setSaveError(`Qty fisik "${invalid.productName}" harus bilangan bulat 0 atau lebih`)
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(null)

    try {
      const res = await fetch(`/api/bo/stock-opnames/${soId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: dirtyCandidates.map((c) => {
            const draft = drafts[draftKey(c.productId, c.uomId)]
            const base = {
              physicalQty: Number(draft.physicalQty),
              varianceReason: draft.varianceReason.trim() || null,
            }
            return c.soItemId !== null
              ? { id: c.soItemId, ...base }
              : { productId: c.productId, uomId: c.uomId, ...base }
          }),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setSaveError(data.error ?? `Gagal menyimpan koreksi item (${res.status})`)
        return
      }

      type SavedItem = {
        id: number
        productId: number
        uomId: number
        physicalQty: number
        varianceQty: number
        varianceCostValue: number
        varianceReason: string | null
        itemStatus: string | null
      }
      const savedByKey = new Map(
        (data.items as SavedItem[]).map((item) => [draftKey(item.productId, item.uomId), item])
      )

      setCandidates((prev) =>
        prev.map((c) => {
          const saved = savedByKey.get(draftKey(c.productId, c.uomId))
          if (!saved) return c
          return {
            ...c,
            soItemId: saved.id,
            physicalQty: saved.physicalQty,
            varianceQty: saved.varianceQty,
            varianceCostValue: saved.varianceCostValue,
            varianceReason: saved.varianceReason,
            itemStatus: saved.itemStatus,
          }
        })
      )
      setDrafts((prev) => {
        const next = { ...prev }
        for (const c of dirtyCandidates) delete next[draftKey(c.productId, c.uomId)]
        return next
      })
      setSaveSuccess(`${dirtyCandidates.length} item berhasil disimpan`)
      onItemsChanged()
    } catch {
      setSaveError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSaving(false)
    }
  }

  function updateDraft(key: string, next: ItemDraft) {
    setDrafts((prev) => ({ ...prev, [key]: next }))
  }

  function startReject(itemId: number) {
    setRejectingItemId(itemId)
    setItemRejectNote('')
    setDecideError(null)
  }

  function cancelReject() {
    setRejectingItemId(null)
    setItemRejectNote('')
  }

  async function handleDecide(itemId: number, action: 'APPROVE' | 'REJECT', note?: string) {
    if (action === 'REJECT' && !note?.trim()) {
      setDecideError('Alasan wajib diisi untuk menolak item')
      return
    }

    setDecideProcessingId(itemId)
    setDecideError(null)
    setDecideSuccess(null)

    try {
      const res = await fetch(`/api/bo/stock-opnames/${soId}/items/decide`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: [{ itemId, action, note: note?.trim() || undefined }] }),
      })
      const data = await res.json()

      if (!res.ok) {
        setDecideError(data.error ?? `Gagal memproses keputusan item (${res.status})`)
        return
      }

      const newItemStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
      setCandidates((prev) =>
        prev.map((c) =>
          c.soItemId === itemId ? { ...c, itemStatus: newItemStatus, decisionNote: note?.trim() || null } : c
        )
      )
      setRejectingItemId(null)
      setItemRejectNote('')

      if (data.soClosed) {
        clearSOFullDraft(soId)
        setDecideSuccess('Semua item sudah diputuskan — SO ditutup otomatis dan stok diperbarui')
      } else {
        setDecideSuccess(action === 'APPROVE' ? 'Item disetujui, stok diperbarui' : 'Item ditolak')
      }
      onItemsChanged()
    } catch {
      setDecideError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setDecideProcessingId(null)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return candidates.filter((c) => {
      if (onlyUnfilled && c.soItemId !== null) return false
      if (!term) return true
      return c.productName.toLowerCase().includes(term) || (c.sku ?? '').toLowerCase().includes(term)
    })
  }, [candidates, search, onlyUnfilled])

  // useMemo(..., []) supaya referensi fungsi cell stabil lintas render — semua nilai
  // yang berubah-ubah (drafts tiap ketikan, dst) dibaca lewat table.options.meta,
  // bukan closure di sini. Lihat komentar CandidateTableMeta & data-table.tsx.
  const columns = useMemo<ColumnDef<CandidateItem>[]>(
    () => [
      {
        id: 'product',
        header: 'Produk',
        cell: ({ row }) => (
          <div>
            <div className="text-foreground">{row.original.productName}</div>
            {row.original.sku && <div className="text-[11px] text-muted-foreground">{row.original.sku}</div>}
          </div>
        ),
      },
      {
        id: 'uom',
        header: 'UOM',
        cell: ({ row }) => row.original.uomCode,
      },
      {
        id: 'systemQty',
        header: () => <div className="text-right">System</div>,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="text-right tabular-nums">
              {c.systemQty}
              {c.liveSystemQty !== c.systemQty && (
                <span className="block text-[11px] font-normal text-amber-600">kini: {c.liveSystemQty}</span>
              )}
            </div>
          )
        },
      },
      {
        id: 'physicalQty',
        header: () => <div className="text-right">Fisik</div>,
        cell: ({ row, table }) => {
          const c = row.original
          const meta = table.options.meta as CandidateTableMeta
          const key = draftKey(c.productId, c.uomId)
          const draft = meta.drafts[key] ?? toDraft(c)
          const locked = c.itemStatus === 'APPROVED' || c.itemStatus === 'REJECTED'
          const qty = Number(draft.physicalQty)
          const qtyValid = draft.physicalQty.trim() === '' || (Number.isInteger(qty) && qty >= 0)

          if (locked) return <div className="text-right tabular-nums">{c.physicalQty}</div>

          return (
            <input
              type="number"
              min={0}
              step={1}
              value={draft.physicalQty}
              onChange={(e) => meta.onDraftChange(key, { ...draft, physicalQty: e.target.value })}
              disabled={meta.saving}
              placeholder="-"
              aria-label={`Qty fisik ${c.productName}`}
              aria-invalid={!qtyValid}
              className={`w-24 rounded-md border px-2 py-1 text-right text-sm tabular-nums bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${
                qtyValid ? 'border-input' : 'border-destructive'
              }`}
            />
          )
        },
      },
      {
        id: 'varianceQty',
        header: () => <div className="text-right">Selisih</div>,
        cell: ({ row, table }) => {
          const c = row.original
          const meta = table.options.meta as CandidateTableMeta
          const draft = meta.drafts[draftKey(c.productId, c.uomId)]
          const draftQty = draft ? Number(draft.physicalQty) : NaN
          const qtyValid = !!draft && draft.physicalQty.trim() !== '' && Number.isInteger(draftQty) && draftQty >= 0
          const preview = qtyValid ? draftQty - c.systemQty : c.varianceQty

          if (preview === null) return <span className="text-muted-foreground">-</span>
          return (
            <div
              className={`text-right tabular-nums font-medium ${
                preview > 0 ? 'text-green-700' : preview < 0 ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {preview > 0 ? `+${preview}` : preview}
            </div>
          )
        },
      },
      {
        id: 'varianceCostValue',
        header: () => <div className="text-right">Nilai Selisih</div>,
        cell: ({ row, table }) => {
          const c = row.original
          const meta = table.options.meta as CandidateTableMeta
          const draft = meta.drafts[draftKey(c.productId, c.uomId)]
          const dirty = draft ? isCandidateDirty(c, draft) : false
          if (dirty) return <span className="text-xs italic text-muted-foreground">dihitung ulang saat disimpan</span>
          return <div className="text-right tabular-nums">{formatRupiah(c.varianceCostValue)}</div>
        },
      },
      {
        id: 'varianceReason',
        header: 'Alasan',
        cell: ({ row, table }) => {
          const c = row.original
          const meta = table.options.meta as CandidateTableMeta
          const key = draftKey(c.productId, c.uomId)
          const draft = meta.drafts[key] ?? toDraft(c)
          const locked = c.itemStatus === 'APPROVED' || c.itemStatus === 'REJECTED'

          if (locked) return c.varianceReason?.trim() || '-'

          return (
            <input
              type="text"
              value={draft.varianceReason}
              onChange={(e) => meta.onDraftChange(key, { ...draft, varianceReason: e.target.value })}
              disabled={meta.saving}
              maxLength={500}
              placeholder="Alasan selisih"
              aria-label={`Alasan selisih ${c.productName}`}
              className="w-full min-w-40 rounded-md border border-input px-2 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <ItemStatusBadge status={row.original.itemStatus} />,
      },
      {
        id: 'recount',
        header: 'Hitung Ulang',
        cell: ({ row }) => {
          const c = row.original
          if (c.isRecounted) {
            return (
              <span className="text-xs text-muted-foreground">
                Fisik ke-2: <span className="font-medium text-foreground">{c.recountPhysicalQty}</span>
                {c.recountVarianceQty !== null && c.recountVarianceQty !== 0 && (
                  <span className="text-destructive">
                    {' '}
                    (selisih {c.recountVarianceQty > 0 ? `+${c.recountVarianceQty}` : c.recountVarianceQty})
                  </span>
                )}
              </span>
            )
          }
          if (c.itemStatus === 'PENDING') return <span className="text-xs text-amber-600">belum dihitung ulang</span>
          return <span className="text-xs text-muted-foreground">-</span>
        },
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row, table }) => {
          const c = row.original
          const meta = table.options.meta as CandidateTableMeta
          if (c.soItemId === null) return <span className="text-xs text-muted-foreground">Simpan dulu</span>
          if (c.itemStatus !== 'PENDING') {
            return <span className="text-xs text-muted-foreground">{c.decisionNote?.trim() || '-'}</span>
          }

          const draft = meta.drafts[draftKey(c.productId, c.uomId)]
          const dirty = draft ? isCandidateDirty(c, draft) : false

          if (meta.rejectingItemId === c.soItemId) {
            return (
              <div className="min-w-48 space-y-1">
                <textarea
                  value={meta.itemRejectNote}
                  onChange={(e) => meta.onChangeRejectNote(e.target.value)}
                  placeholder="Alasan tolak (wajib)"
                  rows={2}
                  disabled={meta.decideProcessingId !== null}
                  aria-label={`Alasan tolak ${c.productName}`}
                  className="w-full rounded-md border border-input px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => meta.onSubmitReject(c.soItemId!, meta.itemRejectNote)}
                    disabled={meta.decideProcessingId !== null || !meta.itemRejectNote.trim()}
                    className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {meta.decideProcessingId === c.soItemId ? 'Memproses...' : 'Kirim'}
                  </button>
                  <button
                    type="button"
                    onClick={meta.onCancelReject}
                    disabled={meta.decideProcessingId !== null}
                    className="px-2 py-1 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => meta.onApprove(c.soItemId!)}
                disabled={meta.decideProcessingId !== null || dirty}
                title={dirty ? 'Simpan koreksi item terlebih dahulu' : undefined}
                className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {meta.decideProcessingId === c.soItemId ? 'Memproses...' : 'Setujui'}
              </button>
              <button
                type="button"
                onClick={() => meta.onStartReject(c.soItemId!)}
                disabled={meta.decideProcessingId !== null}
                className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Tolak
              </button>
            </div>
          )
        },
      },
    ],
    []
  )

  const tableMeta: CandidateTableMeta = {
    drafts,
    saving,
    decideProcessingId,
    rejectingItemId,
    itemRejectNote,
    onDraftChange: updateDraft,
    onApprove: (itemId) => handleDecide(itemId, 'APPROVE'),
    onStartReject: startReject,
    onCancelReject: cancelReject,
    onChangeRejectNote: setItemRejectNote,
    onSubmitReject: (itemId, note) => handleDecide(itemId, 'REJECT', note),
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama atau SKU produk..."
        className="w-64 rounded-md border border-input px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={onlyUnfilled}
          onChange={(e) => setOnlyUnfilled(e.target.checked)}
          className="rounded"
        />
        Hanya yang belum diisi
      </label>
      <div className="ml-auto flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Per halaman</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-md border border-input px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={refreshCandidates}
          disabled={refreshing}
          className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? 'Memuat...' : 'Refresh Stok Terkini'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Daftar produk dengan histori penjualan 30 hari terakhir atau stok sistem tidak nol di cabang ini. Isi qty
        fisik lalu Simpan Koreksi &mdash; item yang cocok otomatis (tanpa selisih) tidak perlu keputusan, sisanya
        diputuskan satu per satu di bawah.
      </p>

      {loadError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}
      {saveError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {saveSuccess}
        </div>
      )}
      {decideError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {decideError}
        </div>
      )}
      {decideSuccess && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {decideSuccess}
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        pageSize={pageSize}
        isLoading={loading}
        loadingMessage="Memuat daftar kandidat produk..."
        emptyMessage={onlyUnfilled ? 'Semua produk sudah terisi.' : 'Tidak ada produk yang memenuhi kriteria.'}
        toolbar={toolbar}
        meta={tableMeta}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {dirtyCandidates.length > 0 ? `${dirtyCandidates.length} item belum disimpan` : ''}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || dirtyCandidates.length === 0}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Menyimpan...' : 'Simpan Koreksi'}
        </button>
      </div>
    </div>
  )
}
