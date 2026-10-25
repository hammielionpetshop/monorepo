'use client'

import { useEffect, useMemo, useState } from 'react'
import { matchesSearchWords } from '@/lib/search-words'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { NewBadge } from '@/components/ui/new-badge'
import { clearSOFullDraft, readSOFullDraft, writeSOFullDraft, type SOFullDraftItems } from './so-full-draft-storage'

export interface CandidateItem {
  productId: number
  productName: string
  sku: string | null
  uomId: number
  uomCode: string
  baseUomId: number
  // Satuan produk (dasar + besar) beserta rasio ke satuan dasar, urut rasio terbesar
  // dulu. Dipakai alat bantu "ketik per satuan" di kolom Fisik.
  uoms: { id: number; code: string; ratio: number }[]
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
  // Hanya untuk dokumen hitung ulang: hitung#1 & mutasi stok sejak SO induk disetujui.
  parentPhysicalQty: number | null
  parentVarianceQty: number | null
  movementSinceParent: number | null
}

interface RecountContext {
  parentSoId: number
  parentSoNumber: string
  parentCompletedAt: string | null
}

interface ItemDraft {
  physicalQty: string
  varianceReason: string
  // Rincian per satuan (uomId → qty) saat qty fisik diisi lewat alat bantu satuan.
  // physicalQty tetap angka resmi (total satuan dasar); breakdown hanya untuk
  // menampilkan jejak "1 SAK + 2 BOX" & mengisi ulang panel.
  breakdown?: Record<string, string>
}

type ProductUom = { id: number; code: string; ratio: number }

// Produk layak pakai alat bantu satuan hanya bila baris memakai satuan dasar
// (nilai Fisik ditafsirkan server dalam satuan baris) dan punya lebih dari satu satuan.
function isMultiUomEligible(c: CandidateItem): boolean {
  return c.uomId === c.baseUomId && c.uoms.length > 1
}

// Total satuan dasar dari rincian per satuan: Σ qty × rasio.
function breakdownTotal(breakdown: Record<string, string> | undefined, uoms: ProductUom[]): number {
  if (!breakdown) return 0
  return uoms.reduce((sum, u) => sum + Number(breakdown[u.id] || 0) * u.ratio, 0)
}

function breakdownHasEntry(breakdown: Record<string, string> | undefined): boolean {
  if (!breakdown) return false
  return Object.values(breakdown).some((v) => v.trim() !== '' && Number(v) > 0)
}

// Jejak ringkas untuk ditampilkan di bawah kotak: "1 SAK + 2 BOX".
function formatBreakdown(breakdown: Record<string, string> | undefined, uoms: ProductUom[]): string {
  if (!breakdown) return ''
  return uoms
    .filter((u) => Number(breakdown[u.id] || 0) > 0)
    .map((u) => `${Number(breakdown[u.id])} ${u.code}`)
    .join(' + ')
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
  openUnitKeys: Set<string>
  onToggleUnitPanel: (key: string) => void
  onDraftChange: (key: string, next: ItemDraft) => void
  onLockItem: (candidate: CandidateItem) => void
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

// Pesan error opname bisa panjang (mis. stok tidak cukup + saran hitung ulang) —
// beri waktu baca lebih lama dari toast sukses.
function showError(message: string) {
  toast.error(message, { duration: 10000 })
}

type StatusFilter = 'ALL' | 'UNFILLED' | 'UNCONFIRMED' | 'PLUS' | 'MINUS'

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua item' },
  { value: 'UNFILLED', label: 'Belum diisi' },
  { value: 'UNCONFIRMED', label: 'Belum dikonfirmasi' },
  { value: 'PLUS', label: 'Barang plus (lebih)' },
  { value: 'MINUS', label: 'Barang minus (kurang)' },
]

const STATUS_FILTER_EMPTY: Record<StatusFilter, string> = {
  ALL: 'Tidak ada produk yang memenuhi kriteria.',
  UNFILLED: 'Semua produk sudah terisi.',
  UNCONFIRMED: 'Tidak ada item yang menunggu konfirmasi.',
  PLUS: 'Belum ada barang plus (fisik lebih dari sistem) yang tersimpan.',
  MINUS: 'Belum ada barang minus (fisik kurang dari sistem) yang tersimpan.',
}

export default function SOFullInputTable({ soId, onItemsChanged }: Props) {
  const [candidates, setCandidates] = useState<CandidateItem[]>([])
  const [recount, setRecount] = useState<RecountContext | null>(null)
  const [hideParentMatched, setHideParentMatched] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [pageSize, setPageSize] = useState(25)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [decideProcessingId, setDecideProcessingId] = useState<number | null>(null)
  const [rejectingItemId, setRejectingItemId] = useState<number | null>(null)
  const [itemRejectNote, setItemRejectNote] = useState('')
  const [openUnitKeys, setOpenUnitKeys] = useState<Set<string>>(new Set())

  function toggleUnitPanel(key: string) {
    setOpenUnitKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
        setRecount((data.recount as RecountContext | null) ?? null)

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
      setRecount((data.recount as RecountContext | null) ?? null)
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

  // Dipakai tombol "Simpan Koreksi" (semua baris dirty sekaligus) maupun tombol
  // "Kunci" per baris (satu item saja) — keduanya lewat PATCH yang sama, bedanya
  // cuma cakupan. "Kunci" ada supaya qty fisik yang baru saja dihitung langsung
  // disimpan server-side saat itu juga: utk item yang belum pernah tersimpan,
  // systemQty dibaca live oleh server pada saat PATCH diterima (lihat komentar di
  // route), jadi kalau disimpan lama setelah dihitung (mis. batch "Simpan Koreksi"
  // di akhir sesi hitung yang berjam-jam), transaksi jual/beli yang terjadi di
  // antaranya ikut mengubah systemQty pembanding — selisihnya jadi bukan
  // selisih hitung fisik yang sebenarnya. "Kunci" segera menutup jendela itu per item.
  async function saveCandidates(itemsToSave: CandidateItem[]) {
    if (itemsToSave.length === 0) return

    const invalid = itemsToSave.find((c) => {
      const draft = drafts[draftKey(c.productId, c.uomId)]
      const qty = Number(draft.physicalQty)
      return !Number.isInteger(qty) || qty < 0
    })
    if (invalid) {
      showError(`Qty fisik "${invalid.productName}" harus bilangan bulat 0 atau lebih`)
      return
    }

    setSaving(true)

    try {
      const res = await fetch(`/api/bo/stock-opnames/${soId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSave.map((c) => {
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
        showError(data.error ?? `Gagal menyimpan koreksi item (${res.status})`)
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
        for (const c of itemsToSave) delete next[draftKey(c.productId, c.uomId)]
        return next
      })
      toast.success(
        itemsToSave.length === 1
          ? `"${itemsToSave[0].productName}" dikunci`
          : `${itemsToSave.length} item berhasil disimpan`
      )
      onItemsChanged()
    } catch {
      showError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSaving(false)
    }
  }

  function handleSave() {
    return saveCandidates(dirtyCandidates)
  }

  function handleLockItem(candidate: CandidateItem) {
    return saveCandidates([candidate])
  }

  function updateDraft(key: string, next: ItemDraft) {
    setDrafts((prev) => ({ ...prev, [key]: next }))
  }

  function startReject(itemId: number) {
    setRejectingItemId(itemId)
    setItemRejectNote('')
  }

  function cancelReject() {
    setRejectingItemId(null)
    setItemRejectNote('')
  }

  async function handleDecide(itemId: number, action: 'APPROVE' | 'REJECT', note?: string) {
    if (action === 'REJECT' && !note?.trim()) {
      showError('Alasan wajib diisi untuk menolak item')
      return
    }

    setDecideProcessingId(itemId)

    try {
      const res = await fetch(`/api/bo/stock-opnames/${soId}/items/decide`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: [{ itemId, action, note: note?.trim() || undefined }] }),
      })
      const data = await res.json()

      if (!res.ok) {
        showError(data.error ?? `Gagal memproses keputusan item (${res.status})`)
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

      toast.success(action === 'APPROVE' ? 'Item disetujui, stok diperbarui' : 'Item ditolak')
      onItemsChanged()
    } catch {
      showError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setDecideProcessingId(null)
    }
  }

  // Selesaikan (tutup) SO Besar manual — hanya saat semua item sudah diputuskan & tidak
  // ada draft tersisa. Mengunci dokumen + menyamakan stok item yang cocok otomatis.
  async function handleFinish() {
    if (
      !window.confirm(
        'Selesaikan SO Besar ini? Dokumen akan dikunci (tidak bisa ditambah/diubah lagi) dan stok item yang cocok otomatis ikut disamakan. Lanjutkan?'
      )
    ) {
      return
    }
    setFinishing(true)
    try {
      const res = await fetch(`/api/bo/stock-opnames/${soId}/finish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showError(data.error ?? `Gagal menyelesaikan SO (${res.status})`)
        return
      }
      clearSOFullDraft(soId)
      toast.success('SO Besar selesai — dokumen ditutup & stok diperbarui')
      onItemsChanged()
    } catch {
      showError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setFinishing(false)
    }
  }

  // Filter plus/minus memakai selisih yang SUDAH tersimpan (varianceQty), bukan draft
  // yang belum dikunci — supaya daftar tidak melompat-lompat selagi qty fisik diketik
  // dan konsisten dengan kartu ringkasan (yang juga dari nilai tersimpan).
  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      // Mode hitung ulang: default sembunyikan item yang di SO induk sudah cocok (selisih 0),
      // kecuali item itu sudah diisi di dokumen hitung ulang ini.
      if (recount && hideParentMatched && c.parentVarianceQty === 0 && c.soItemId === null) return false
      if (statusFilter === 'UNFILLED' && c.soItemId !== null) return false
      if (statusFilter === 'UNCONFIRMED' && c.itemStatus !== 'PENDING') return false
      if (statusFilter === 'PLUS' && !(c.varianceQty !== null && c.varianceQty > 0)) return false
      if (statusFilter === 'MINUS' && !(c.varianceQty !== null && c.varianceQty < 0)) return false
      return matchesSearchWords(search, [c.productName, c.sku])
    })
  }, [candidates, search, statusFilter, recount, hideParentMatched])

  const unconfirmedCount = useMemo(
    () => candidates.filter((c) => c.itemStatus === 'PENDING').length,
    [candidates]
  )

  // Perkiraan nilai selisih dari item yang sudah tersimpan/terkunci (varianceCostValue
  // hanya ada setelah disimpan — item yang masih draft belum punya nilai rupiahnya).
  // varianceCostValue selalu besaran positif (dihitung dari |selisih| di server), jadi
  // tandanya diambil dari varianceQty: plus = barang lebih, minus = barang kurang.
  const summary = useMemo(() => {
    let plusValue = 0
    let minusValue = 0
    let plusCount = 0
    let minusCount = 0
    for (const c of candidates) {
      if (c.varianceQty === null || c.varianceCostValue === null) continue
      if (c.varianceQty > 0) {
        plusValue += c.varianceCostValue
        plusCount += 1
      } else if (c.varianceQty < 0) {
        minusValue += c.varianceCostValue
        minusCount += 1
      }
    }
    // Kehilangan barang = nilai plus - nilai minus. Positif = kelebihan (hijau),
    // negatif = kekurangan yang perlu diganti karyawan (merah).
    return { plusValue, minusValue, plusCount, minusCount, net: plusValue - minusValue }
  }, [candidates])

  const isRecount = recount !== null

  // useMemo supaya referensi fungsi cell stabil lintas render — semua nilai yang
  // berubah-ubah (drafts tiap ketikan, dst) dibaca lewat table.options.meta, bukan
  // closure di sini. Bergantung pada `isRecount` saja (stabil per SO) untuk menambah
  // kolom khusus hitung ulang. Lihat komentar CandidateTableMeta & data-table.tsx.
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
      ...(isRecount
        ? [
            {
              id: 'parentPhysicalQty',
              header: () => <div className="text-right">Fisik SO Induk</div>,
              cell: ({ row }: { row: { original: CandidateItem } }) => (
                <div className="text-right tabular-nums text-muted-foreground">
                  {row.original.parentPhysicalQty ?? '-'}
                </div>
              ),
            },
            {
              id: 'movementSinceParent',
              header: () => <div className="text-right">Mutasi sejak Induk</div>,
              cell: ({ row }: { row: { original: CandidateItem } }) => {
                const m = row.original.movementSinceParent
                if (m === null) return <div className="text-right text-muted-foreground">-</div>
                return (
                  <div
                    className={`text-right tabular-nums ${
                      m > 0 ? 'text-green-700' : m < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                    title="Penjualan, PO masuk, retur & transfer yang tercatat sejak SO induk disetujui (sudah otomatis diperhitungkan pada stok sistem)"
                  >
                    {m > 0 ? `+${m}` : m}
                  </div>
                )
              },
            },
          ]
        : []),
      {
        id: 'systemQty',
        header: () => <div className="text-right">{isRecount ? 'Sistem kini' : 'System'}</div>,
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
        header: () => (
          <div className="flex items-center justify-end gap-1">
            <span>Fisik</span>
            <NewBadge feature="fitur/so-input-satuan" />
          </div>
        ),
        cell: ({ row, table }) => {
          const c = row.original
          const meta = table.options.meta as CandidateTableMeta
          const key = draftKey(c.productId, c.uomId)
          const draft = meta.drafts[key] ?? toDraft(c)
          const locked = c.itemStatus === 'APPROVED' || c.itemStatus === 'REJECTED'
          const qty = Number(draft.physicalQty)
          const qtyValid = draft.physicalQty.trim() === '' || (Number.isInteger(qty) && qty >= 0)
          const dirty = isCandidateDirty(c, draft)
          const canLock = dirty && draft.physicalQty.trim() !== '' && qtyValid

          if (locked) return <div className="text-right tabular-nums">{c.physicalQty}</div>

          const multiUom = isMultiUomEligible(c)
          const panelOpen = multiUom && meta.openUnitKeys.has(key)
          const jejak = formatBreakdown(draft.breakdown, c.uoms)

          // Ketik per satuan → total satuan dasar masuk ke physicalQty. Kosong semua = '-'.
          const setUnit = (uomId: number, raw: string) => {
            const digits = raw.replace(/[^0-9]/g, '')
            const nextBreakdown = { ...(draft.breakdown ?? {}), [String(uomId)]: digits }
            const filled = breakdownHasEntry(nextBreakdown)
            meta.onDraftChange(key, {
              ...draft,
              breakdown: nextBreakdown,
              physicalQty: filled ? String(breakdownTotal(nextBreakdown, c.uoms)) : '',
            })
          }

          return (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center justify-end gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.physicalQty}
                  // Ketik langsung di kotak = batalkan rincian satuan (angka jadi acuan).
                  onChange={(e) =>
                    meta.onDraftChange(key, { ...draft, physicalQty: e.target.value, breakdown: undefined })
                  }
                  disabled={meta.saving}
                  placeholder="-"
                  aria-label={`Qty fisik ${c.productName}`}
                  aria-invalid={!qtyValid}
                  className={`w-24 rounded-md border px-2 py-1 text-right text-sm tabular-nums bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${
                    qtyValid ? 'border-input' : 'border-destructive'
                  }`}
                />
                {multiUom && (
                  <button
                    type="button"
                    onClick={() => meta.onToggleUnitPanel(key)}
                    disabled={meta.saving}
                    title="Ketik jumlah per satuan (mis. 1 SAK + 2 PCS) — total dihitung otomatis"
                    aria-expanded={panelOpen}
                    className={`shrink-0 px-2 py-1 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${
                      panelOpen
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    ⊞ Satuan
                  </button>
                )}
                {canLock ? (
                  <button
                    type="button"
                    onClick={() => meta.onLockItem(c)}
                    disabled={meta.saving}
                    title="Simpan & kunci qty fisik baris ini sekarang, supaya stok sistem pembanding tidak ikut bergeser oleh transaksi berikutnya"
                    className="shrink-0 px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Kunci
                  </button>
                ) : c.soItemId !== null ? (
                  <span className="shrink-0 text-xs text-muted-foreground" title="Qty fisik sudah disimpan & terkunci">
                    🔒
                  </span>
                ) : null}
              </div>

              {panelOpen && (
                <div className="w-full max-w-[17rem] rounded-md border border-border bg-muted/30 p-2 space-y-1">
                  {c.uoms.map((u) => {
                    const sub = draft.breakdown?.[String(u.id)] ?? ''
                    return (
                      <div key={u.id} className="flex items-center justify-end gap-2 text-xs">
                        <span className="w-12 text-right font-medium text-foreground">{u.code}</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={sub}
                          onChange={(e) => setUnit(u.id, e.target.value)}
                          disabled={meta.saving}
                          placeholder="0"
                          aria-label={`Jumlah ${u.code} ${c.productName}`}
                          className="w-16 rounded border border-input px-2 py-1 text-right tabular-nums bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                        <span className="w-20 text-right text-muted-foreground tabular-nums">
                          × {u.ratio} = {Number(sub || 0) * u.ratio}
                        </span>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between border-t border-border pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => meta.onToggleUnitPanel(key)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Tutup
                    </button>
                    <span className="font-semibold tabular-nums text-foreground">
                      TOTAL = {breakdownTotal(draft.breakdown, c.uoms)} {c.uomCode}
                    </span>
                  </div>
                </div>
              )}

              {!panelOpen && jejak && <span className="text-[11px] text-muted-foreground">{jejak}</span>}
            </div>
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
    [isRecount]
  )

  const tableMeta: CandidateTableMeta = {
    drafts,
    saving,
    decideProcessingId,
    rejectingItemId,
    itemRejectNote,
    openUnitKeys,
    onToggleUnitPanel: toggleUnitPanel,
    onDraftChange: updateDraft,
    onLockItem: handleLockItem,
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
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        aria-label="Filter status item"
        className="rounded-md border border-input px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {STATUS_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.value === 'UNCONFIRMED' ? ` (${unconfirmedCount})` : ''}
            {option.value === 'PLUS' ? ` (${summary.plusCount})` : ''}
            {option.value === 'MINUS' ? ` (${summary.minusCount})` : ''}
          </option>
        ))}
      </select>
      {isRecount && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={!hideParentMatched}
            onChange={(e) => setHideParentMatched(!e.target.checked)}
            className="rounded"
          />
          Tampilkan juga item yang cocok di SO induk
        </label>
      )}
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

  // Kesiapan "Selesaikan SO Besar": ada item tersimpan, tak ada yang menunggu
  // keputusan, dan tak ada koreksi yang belum disimpan.
  const savedItemCount = candidates.filter((c) => c.soItemId !== null).length
  const finishReady = savedItemCount > 0 && unconfirmedCount === 0 && dirtyCandidates.length === 0
  const finishTitle =
    savedItemCount === 0
      ? 'Belum ada item yang dihitung'
      : dirtyCandidates.length > 0
        ? 'Simpan dulu koreksi yang belum disimpan'
        : unconfirmedCount > 0
          ? `Masih ada ${unconfirmedCount} item menunggu keputusan`
          : undefined

  return (
    <div className="space-y-3">
      {isRecount ? (
        <p className="text-xs text-muted-foreground">
          Hitung ulang dari <strong>{recount?.parentSoNumber}</strong>. Daftar dibatasi ke item SO induk
          (default hanya yang berselisih). Isi qty fisik ke-2 lalu klik <strong>Kunci</strong> &mdash; stok
          <strong> sistem kini</strong> jadi pembanding dan sudah memperhitungkan semua transaksi sejak SO
          induk (lihat kolom <em>Mutasi sejak Induk</em>). Setujui per item untuk mengoreksi stok; nilainya
          tidak dijumlah sebagai kehilangan baru di laporan.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Daftar semua produk aktif di master data, termasuk yang stok sistemnya 0. Isi qty
          fisik lalu klik <strong>Kunci</strong> di baris itu untuk menyimpannya seketika &mdash; supaya stok sistem
          yang dibandingkan tidak ikut bergeser oleh transaksi yang terjadi selagi penghitungan baris lain masih
          berlangsung. Atau isi beberapa baris sekaligus lalu <strong>Simpan Koreksi</strong> di bawah. Item yang
          cocok otomatis (tanpa selisih) tidak perlu keputusan, sisanya diputuskan satu per satu di bawah.
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Perkiraan Nilai Selisih</h3>
          <NewBadge feature="fitur/so-ringkasan-selisih" />
          <span className="text-[11px] text-muted-foreground">
            dari item yang sudah disimpan/dikunci
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Barang Plus (lebih){summary.plusCount > 0 ? ` · ${summary.plusCount} item` : ''}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-green-700">
              {formatRupiah(summary.plusValue)}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Barang Minus (kurang){summary.minusCount > 0 ? ` · ${summary.minusCount} item` : ''}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-destructive">
              {summary.minusValue > 0 ? `- ${formatRupiah(summary.minusValue)}` : formatRupiah(0)}
            </p>
          </div>
          <div
            className={`rounded-md border px-3 py-2 ${
              summary.net > 0
                ? 'border-green-200 bg-green-50'
                : summary.net < 0
                  ? 'border-destructive/20 bg-destructive/10'
                  : 'border-border bg-background'
            }`}
          >
            <p className="text-xs text-muted-foreground">Kehilangan Barang (plus − minus)</p>
            <p
              className={`mt-1 text-base font-bold tabular-nums ${
                summary.net > 0 ? 'text-green-700' : summary.net < 0 ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {summary.net > 0 ? `+ ${formatRupiah(summary.net)}` : summary.net < 0 ? `- ${formatRupiah(Math.abs(summary.net))}` : formatRupiah(0)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {summary.net > 0
                ? 'Kelebihan barang (surplus)'
                : summary.net < 0
                  ? 'Kekurangan — karyawan mengganti rugi'
                  : 'Seimbang / belum ada selisih'}
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        pageSize={pageSize}
        isLoading={loading}
        loadingMessage="Memuat daftar kandidat produk..."
        emptyMessage={STATUS_FILTER_EMPTY[statusFilter]}
        toolbar={toolbar}
        meta={tableMeta}
        resetPageKey={`${search}|${statusFilter}`}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {dirtyCandidates.length > 0
            ? `${dirtyCandidates.length} item belum disimpan`
            : unconfirmedCount > 0
              ? `${unconfirmedCount} item menunggu keputusan`
              : savedItemCount > 0
                ? 'Semua item sudah diputuskan — siap diselesaikan'
                : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || finishing || dirtyCandidates.length === 0}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Menyimpan...' : 'Simpan Koreksi'}
          </button>
          {/* Penutupan dokumen manual (Opsi A): menyetujui item cuma mengunci angka,
              SO baru selesai saat tombol ini ditekan. */}
          <span className="flex items-center gap-1.5">
            <NewBadge feature="fitur/so-selesaikan-manual" />
            <button
              type="button"
              onClick={handleFinish}
              disabled={finishing || saving || !finishReady}
              title={finishTitle}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {finishing ? 'Menyelesaikan...' : 'Selesaikan SO Besar'}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
