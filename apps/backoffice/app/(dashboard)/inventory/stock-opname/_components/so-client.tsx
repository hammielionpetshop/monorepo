'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import SOFullInputTable from './so-full-input-table'
import { buildSOReviewCsv, soReviewCsvFilename } from '@/lib/so-review-csv'
import type { SOListItem, SOReviewData, SOReviewItem } from '../page'

interface Props {
  initialData: SOListItem[]
  canEditItems: boolean
}

interface ItemDraft {
  physicalQty: string
  varianceReason: string
}

// Nilai/handler yang dibawa ke soColumns lewat `meta` (bukan closure) — rejectReason
// berubah tiap ketikan, dan closure di `columns` yang bergantung padanya akan
// membangun ulang fungsi cell tiap render, membuat flexRender me-remount textarea-nya
// (fokus hilang tiap karakter). Lihat komentar `meta` di components/ui/data-table.tsx.
interface SOTableMeta {
  rejectingId: number | null
  rejectReason: string
  processingId: number | null
  onOpenReview: (id: number) => void
  onApprove: (id: number) => void
  onStartReject: (id: number) => void
  onChangeRejectReason: (value: string) => void
  onSubmitReject: (id: number) => void
  onCancelReject: () => void
}

function toDraft(item: SOReviewItem): ItemDraft {
  return { physicalQty: String(item.physicalQty), varianceReason: item.varianceReason ?? '' }
}

function isDraftDirty(item: SOReviewItem, draft: ItemDraft): boolean {
  const qty = Number(draft.physicalQty)
  const reason = draft.varianceReason.trim()
  if (draft.physicalQty.trim() === '' || !Number.isInteger(qty)) return true
  return qty !== item.physicalQty || reason !== (item.varianceReason ?? '')
}

function formatDate(value: Date | string | undefined): string {
  return formatWIB(value)
}

function formatRupiah(value: number | null | undefined): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

// Item boleh dikoreksi selama belum diputuskan admin — MATCHED masih boleh dikoreksi
// (mis. admin sadar ada selisih yang terlewat), APPROVED/REJECTED sudah terkunci.
function isItemDecidable(status: string | null): boolean {
  return status !== 'APPROVED' && status !== 'REJECTED'
}

const ITEM_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  MATCHED: { label: 'Cocok Otomatis', cls: 'bg-muted text-muted-foreground' },
  PENDING: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Ditolak', cls: 'bg-destructive/10 text-destructive' },
}

function ItemStatusBadge({ status }: { status: string | null }) {
  const badge = status ? ITEM_STATUS_BADGE[status] : null
  if (!badge) return <span className="text-muted-foreground">-</span>
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${badge.cls}`}>{badge.label}</span>
  )
}

export default function SOClient({ initialData, canEditItems }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<SOListItem[]>(initialData)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewData, setReviewData] = useState<SOReviewData | null>(null)
  const [drafts, setDrafts] = useState<Record<number, ItemDraft>>({})
  const [savingEdits, setSavingEdits] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSuccess, setEditSuccess] = useState<string | null>(null)
  const [decideProcessingId, setDecideProcessingId] = useState<number | null>(null)
  const [rejectingItemId, setRejectingItemId] = useState<number | null>(null)
  const [itemRejectNote, setItemRejectNote] = useState('')
  const [decideError, setDecideError] = useState<string | null>(null)
  const [decideSuccess, setDecideSuccess] = useState<string | null>(null)
  const [liveStock, setLiveStock] = useState<Record<number, number>>({})
  const [liveStockLoading, setLiveStockLoading] = useState(false)
  const [liveStockError, setLiveStockError] = useState<string | null>(null)
  const [liveStockFetchedAt, setLiveStockFetchedAt] = useState<Date | null>(null)
  const approveAbortRef = useRef<AbortController | null>(null)
  const rejectAbortRef = useRef<AbortController | null>(null)
  const reviewAbortRef = useRef<AbortController | null>(null)
  const editAbortRef = useRef<AbortController | null>(null)
  const decideAbortRef = useRef<AbortController | null>(null)
  const liveStockAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setItems(initialData)
  }, [initialData])

  useEffect(() => {
    return () => {
      approveAbortRef.current?.abort()
      rejectAbortRef.current?.abort()
      reviewAbortRef.current?.abort()
      editAbortRef.current?.abort()
      decideAbortRef.current?.abort()
      liveStockAbortRef.current?.abort()
    }
  }, [])

  // Ekspor dari data yang sudah dimuat modal — tidak query ulang — supaya isinya
  // persis sama dengan yang sedang ditinjau. Berguna untuk SO Besar yang barisnya
  // banyak: penyetuju bisa menelusurinya di Excel.
  function handleExportReviewCsv() {
    if (!reviewData) return
    const blob = new Blob([buildSOReviewCsv(reviewData.items)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = soReviewCsvFilename(reviewData.header)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function closeReviewModal() {
    reviewAbortRef.current?.abort()
    reviewAbortRef.current = null
    editAbortRef.current?.abort()
    editAbortRef.current = null
    decideAbortRef.current?.abort()
    decideAbortRef.current = null
    liveStockAbortRef.current?.abort()
    liveStockAbortRef.current = null
    setReviewOpen(false)
    setReviewLoading(false)
    setReviewError(null)
    setReviewingId(null)
    setReviewData(null)
    setDrafts({})
    setSavingEdits(false)
    setEditError(null)
    setEditSuccess(null)
    setDecideProcessingId(null)
    setRejectingItemId(null)
    setItemRejectNote('')
    setDecideError(null)
    setDecideSuccess(null)
    setLiveStock({})
    setLiveStockLoading(false)
    setLiveStockError(null)
    setLiveStockFetchedAt(null)
  }

  async function fetchLiveStock(id: number) {
    setLiveStockLoading(true)
    setLiveStockError(null)

    liveStockAbortRef.current?.abort()
    const controller = new AbortController()
    liveStockAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${id}/current-stock`, {
        method: 'GET',
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setLiveStockError(data.error ?? `Gagal memuat stok terkini (${res.status})`)
        return
      }

      setLiveStock(
        Object.fromEntries(
          (data.items as { itemId: number; currentSystemQty: number }[]).map((item) => [
            item.itemId,
            item.currentSystemQty,
          ])
        )
      )
      setLiveStockFetchedAt(new Date())
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setLiveStockError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setLiveStockLoading(false)
      if (liveStockAbortRef.current === controller) liveStockAbortRef.current = null
    }
  }

  async function openReviewModal(id: number) {
    setReviewOpen(true)
    setReviewingId(id)
    setReviewLoading(true)
    setReviewError(null)
    setReviewData(null)
    setDrafts({})
    setEditError(null)
    setEditSuccess(null)
    setRejectingItemId(null)
    setItemRejectNote('')
    setDecideError(null)
    setDecideSuccess(null)
    setLiveStock({})
    setLiveStockError(null)
    setLiveStockFetchedAt(null)

    reviewAbortRef.current?.abort()
    const controller = new AbortController()
    reviewAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${id}`, {
        method: 'GET',
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setReviewError(data.error ?? `Gagal memuat detail stock opname (${res.status})`)
        return
      }

      setReviewData(data)
      setDrafts(
        Object.fromEntries((data.items as SOReviewItem[]).map((item) => [item.id, toDraft(item)]))
      )
      fetchLiveStock(id)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setReviewError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setReviewLoading(false)
      if (reviewAbortRef.current === controller) reviewAbortRef.current = null
    }
  }

  // Dipanggil SOFullInputTable setelah simpan/keputusan berhasil — komponen itu
  // mengelola daftar kandidatnya sendiri, jadi reviewData di sini cuma perlu
  // disegarkan untuk kartu ringkasan (jumlah item, status) & badge di luar modal.
  async function refreshReviewData() {
    if (reviewingId === null) return
    try {
      const res = await fetch(`/api/bo/stock-opnames/${reviewingId}`)
      const data = await res.json()
      if (res.ok) {
        setReviewData(data)
        if (data.header.status === 'APPROVED' || data.header.status === 'REJECTED') {
          setItems((prev) => prev.filter((so) => so.id !== reviewingId))
        }
      }
    } catch {
      // kartu ringkasan jadi telat sampai user coba lagi — tidak fatal, SOFullInputTable
      // tetap konsisten dengan state-nya sendiri.
    }
    router.refresh()
  }

  async function handleSaveEdits() {
    if (!reviewData || reviewingId === null) return

    const dirty = reviewData.items.filter((item) => {
      const draft = drafts[item.id]
      return draft !== undefined && isDraftDirty(item, draft)
    })

    if (dirty.length === 0) return

    const invalid = dirty.find((item) => {
      const qty = Number(drafts[item.id].physicalQty)
      return drafts[item.id].physicalQty.trim() === '' || !Number.isInteger(qty) || qty < 0
    })
    if (invalid) {
      setEditError(`Qty fisik "${invalid.productName}" harus bilangan bulat 0 atau lebih`)
      return
    }

    setSavingEdits(true)
    setEditError(null)
    setEditSuccess(null)

    editAbortRef.current?.abort()
    const controller = new AbortController()
    editAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${reviewingId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: dirty.map((item) => ({
            id: item.id,
            physicalQty: Number(drafts[item.id].physicalQty),
            varianceReason: drafts[item.id].varianceReason.trim() || null,
          })),
        }),
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setEditError(data.error ?? `Gagal menyimpan koreksi item (${res.status})`)
        return
      }

      const updatedById = new Map<number, SOReviewItem>(
        (data.items as SOReviewItem[]).map((item) => [item.id, item])
      )
      const mergedItems = reviewData.items.map((item) => {
        const updated = updatedById.get(item.id)
        return updated ? { ...item, ...updated } : item
      })

      setReviewData({ ...reviewData, items: mergedItems })
      setDrafts(Object.fromEntries(mergedItems.map((item) => [item.id, toDraft(item)])))
      setEditSuccess(`${dirty.length} item berhasil dikoreksi`)
      router.refresh()
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setEditError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSavingEdits(false)
      if (editAbortRef.current === controller) editAbortRef.current = null
    }
  }

  async function handleDecideItem(itemId: number, action: 'APPROVE' | 'REJECT', note?: string) {
    if (reviewingId === null) return
    if (action === 'REJECT' && !note?.trim()) {
      setDecideError('Alasan wajib diisi untuk menolak item')
      return
    }

    setDecideProcessingId(itemId)
    setDecideError(null)
    setDecideSuccess(null)

    decideAbortRef.current?.abort()
    const controller = new AbortController()
    decideAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${reviewingId}/items/decide`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions: [{ itemId, action, note: note?.trim() || undefined }],
        }),
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setDecideError(data.error ?? `Gagal memproses keputusan item (${res.status})`)
        return
      }

      const newItemStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
      setReviewData((prev) => {
        if (!prev) return prev
        const mergedItems = prev.items.map((item) =>
          item.id === itemId
            ? { ...item, itemStatus: newItemStatus, decisionNote: note?.trim() || null }
            : item
        )
        const header = data.soClosed ? { ...prev.header, status: 'APPROVED' } : prev.header
        return { ...prev, items: mergedItems, header }
      })

      if (data.soClosed) {
        setItems((prev) => prev.filter((so) => so.id !== reviewingId))
        setDecideSuccess('Semua item sudah diputuskan — SO ditutup otomatis dan stok diperbarui')
      } else {
        setDecideSuccess(action === 'APPROVE' ? 'Item disetujui, stok diperbarui' : 'Item ditolak')
      }
      setRejectingItemId(null)
      setItemRejectNote('')
      router.refresh()
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setDecideError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setDecideProcessingId(null)
      if (decideAbortRef.current === controller) decideAbortRef.current = null
    }
  }

  async function handleApprove(id: number) {
    if (!window.confirm('Setujui SO ini? Stok akan diperbarui.')) return

    setProcessingId(id)
    setErrorMsg(null)
    setSuccessMsg(null)

    approveAbortRef.current?.abort()
    const controller = new AbortController()
    approveAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${id}/approve`, {
        method: 'PATCH',
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menyetujui stock opname (${res.status})`)
        router.refresh()
        return
      }

      setSuccessMsg('Stock opname berhasil disetujui dan stok telah diperbarui')
      setItems((prev) => prev.filter((so) => so.id !== id))
      if (reviewingId === id) closeReviewModal()
      router.refresh()
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setProcessingId(null)
      if (approveAbortRef.current === controller) approveAbortRef.current = null
    }
  }

  async function handleReject(id: number) {
    if (!rejectReason.trim()) {
      setErrorMsg('Alasan penolakan wajib diisi')
      return
    }

    setProcessingId(id)
    setErrorMsg(null)
    setSuccessMsg(null)

    rejectAbortRef.current?.abort()
    const controller = new AbortController()
    rejectAbortRef.current = controller

    try {
      const res = await fetch(`/api/bo/stock-opnames/${id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menolak stock opname (${res.status})`)
        return
      }

      setSuccessMsg('Stock opname berhasil ditolak')
      setItems((prev) => prev.filter((so) => so.id !== id))
      setRejectingId(null)
      setRejectReason('')
      router.refresh()
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setProcessingId(null)
      if (rejectAbortRef.current === controller) rejectAbortRef.current = null
    }
  }

  function startReject(id: number) {
    setRejectingId(id)
    setRejectReason('')
    setErrorMsg(null)
  }

  function cancelReject() {
    setRejectingId(null)
    setRejectReason('')
  }

  // useMemo(..., []) supaya referensi fungsi cell stabil lintas render — semua nilai
  // yang berubah-ubah (rejectReason tiap ketikan, dst) dibaca lewat table.options.meta,
  // bukan closure di sini. Lihat komentar SOTableMeta & data-table.tsx.
  const soColumns = useMemo<ColumnDef<SOListItem>[]>(
    () => [
      {
        accessorKey: 'soNumber',
        header: 'No. SO',
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.soNumber}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status === 'DRAFT' ? (
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
              Dihitung
            </span>
          ) : (
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800">
              Menunggu
            </span>
          ),
      },
      {
        accessorKey: 'type',
        header: 'Tipe',
        cell: ({ row }) => row.original.type,
      },
      {
        accessorKey: 'branchName',
        header: 'Cabang',
        cell: ({ row }) => row.original.branchName,
      },
      {
        accessorKey: 'createdByName',
        header: 'Petugas',
        cell: ({ row }) => row.original.createdByName,
      },
      {
        accessorKey: 'createdAt',
        header: 'Tanggal',
        cell: ({ row }) => <span className="text-xs">{formatDate(row.original.createdAt)}</span>,
      },
      {
        accessorKey: 'itemCount',
        header: () => <div className="text-right">Jml Item</div>,
        cell: ({ row }) => <div className="text-right">{row.original.itemCount}</div>,
      },
      {
        id: 'actions',
        header: () => <div className="text-center">Aksi</div>,
        cell: ({ row, table }) => {
          const so = row.original
          const meta = table.options.meta as SOTableMeta
          return (
            <div className="text-center space-x-2">
              {meta.rejectingId === so.id ? null : (
                <>
                  <button
                    onClick={() => meta.onOpenReview(so.id)}
                    disabled={meta.processingId !== null || meta.rejectingId !== null}
                    className="px-3 py-1 text-xs font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Review
                  </button>
                  {/* SO Besar (FULL) disetujui per item lewat Review — tombol cepat ini
                      cuma untuk SO Harian, satu header sekaligus. */}
                  {so.status === 'PENDING' && so.type !== 'FULL' && (
                    <button
                      onClick={() => meta.onApprove(so.id)}
                      disabled={meta.processingId !== null || meta.rejectingId !== null}
                      className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {meta.processingId === so.id ? 'Memproses...' : 'Setujui'}
                    </button>
                  )}
                  {/* SO Besar yang sudah ada itemnya (PENDING) ditolak per item di Review —
                      API menolak reject header di titik itu, jadi tombolnya disembunyikan. */}
                  {!(so.type === 'FULL' && so.status === 'PENDING') && (
                    <button
                      onClick={() => meta.onStartReject(so.id)}
                      disabled={meta.processingId !== null}
                      className="px-3 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {so.status === 'DRAFT' ? 'Batalkan' : 'Tolak'}
                    </button>
                  )}
                </>
              )}
              {meta.rejectingId === so.id && (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={meta.rejectReason}
                    onChange={(e) => meta.onChangeRejectReason(e.target.value)}
                    placeholder={so.status === 'DRAFT' ? 'Alasan pembatalan (wajib)' : 'Alasan penolakan (wajib)'}
                    rows={2}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => meta.onSubmitReject(so.id)}
                      disabled={meta.processingId !== null || !meta.rejectReason.trim()}
                      className="px-3 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {meta.processingId === so.id
                        ? 'Memproses...'
                        : so.status === 'DRAFT'
                          ? 'Kirim Pembatalan'
                          : 'Kirim Penolakan'}
                    </button>
                    <button
                      onClick={meta.onCancelReject}
                      disabled={meta.processingId !== null}
                      className="px-3 py-1 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        },
      },
    ],
    []
  )

  const soTableMeta: SOTableMeta = {
    rejectingId,
    rejectReason,
    processingId,
    onOpenReview: openReviewModal,
    onApprove: handleApprove,
    onStartReject: startReject,
    onChangeRejectReason: setRejectReason,
    onSubmitReject: handleReject,
    onCancelReject: cancelReject,
  }

  // SO yang sudah APPROVED/REJECTED terkunci — koreksi hanya selama masih
  // dihitung (DRAFT) atau menunggu persetujuan (PENDING).
  const itemsEditable =
    canEditItems &&
    (reviewData?.header.status === 'DRAFT' || reviewData?.header.status === 'PENDING')
  const dirtyCount = reviewData
    ? reviewData.items.filter((item) => {
        const draft = drafts[item.id]
        return draft !== undefined && isDraftDirty(item, draft)
      }).length
    : 0
  const isFullSo = reviewData?.header.type === 'FULL'
  const pendingItemCount = reviewData
    ? reviewData.items.filter((item) => item.itemStatus === 'PENDING').length
    : 0

  return (
    <div>
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm mb-4">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
          {successMsg}
        </div>
      )}

      <DataTable
        data={items}
        columns={soColumns}
        emptyMessage="Tidak ada stock opname yang menunggu persetujuan."
        meta={soTableMeta}
      />

      {reviewOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" role="presentation" onClick={closeReviewModal} />
          <div
            className="fixed inset-x-4 top-8 bottom-8 z-50 mx-auto max-w-6xl rounded-2xl bg-background shadow-xl flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Review Detail Stock Opname"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {reviewData?.header.soNumber ?? 'Review Stock Opname'}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tinjau detail item sebelum menyetujui stock opname.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {!reviewLoading && !reviewError && reviewData && reviewData.items.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportReviewCsv}
                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
                  >
                    Export CSV
                  </button>
                )}
                {/* SO Besar yang masih bisa diedit punya "Refresh Stok Terkini" sendiri
                    di toolbar SOFullInputTable (scoped ke daftar kandidatnya) — tombol
                    di sini cuma relevan untuk SO Harian & SO Besar yang sudah terkunci. */}
                {!reviewLoading && !reviewError && reviewData && !(isFullSo && itemsEditable) && (
                  <div className="flex items-center gap-2 text-right">
                    {liveStockError ? (
                      <span className="text-xs text-destructive">{liveStockError}</span>
                    ) : liveStockFetchedAt ? (
                      <span className="text-xs text-muted-foreground">
                        Stok terkini per {liveStockFetchedAt.toLocaleTimeString('id-ID')}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => reviewingId !== null && fetchLiveStock(reviewingId)}
                      disabled={liveStockLoading || reviewingId === null}
                      className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {liveStockLoading ? 'Memuat...' : 'Refresh Stok Terkini'}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  aria-label="Tutup Review Stock Opname"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {reviewLoading && (
                <div className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                  Memuat detail stock opname...
                </div>
              )}

              {!reviewLoading && reviewError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive space-y-3">
                  <p>{reviewError}</p>
                  {reviewingId !== null && (
                    <button
                      type="button"
                      onClick={() => openReviewModal(reviewingId)}
                      className="px-3 py-1.5 text-xs font-medium border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      Coba lagi
                    </button>
                  )}
                </div>
              )}

              {!reviewLoading && !reviewError && reviewData && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">No. SO</p>
                      <p className="mt-1 font-mono text-sm text-foreground">{reviewData.header.soNumber}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Cabang</p>
                      <p className="mt-1 text-sm text-foreground">{reviewData.header.branchName}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Petugas</p>
                      <p className="mt-1 text-sm text-foreground">{reviewData.header.createdByName}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Tanggal</p>
                      <p className="mt-1 text-sm text-foreground">{formatDate(reviewData.header.createdAt)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Tipe</p>
                      <p className="mt-1 text-sm text-foreground">{reviewData.header.type}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm text-foreground">{reviewData.header.status}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-xs text-muted-foreground">Jumlah Item</p>
                      <p className="mt-1 text-sm text-foreground">{reviewData.header.itemCount}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-card px-4 py-3 sm:col-span-2 lg:col-span-1">
                      <p className="text-xs text-muted-foreground">Catatan</p>
                      <p className="mt-1 text-sm text-foreground">{reviewData.header.notes?.trim() || '-'}</p>
                    </div>
                  </div>

                  {editError && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {editError}
                    </div>
                  )}
                  {editSuccess && (
                    <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                      {editSuccess}
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
                  {itemsEditable && !isFullSo && (
                    <p className="text-xs text-muted-foreground">
                      Qty fisik &amp; alasan bisa dikoreksi. Selisih dan nilai selisih dihitung ulang otomatis
                      dari qty fisik &mdash; simpan koreksi sebelum menyetujui.
                    </p>
                  )}
                  {isFullSo && (
                    <p className="text-xs text-muted-foreground">
                      SO Besar disetujui per item &mdash; item yang cocok otomatis (tanpa selisih) tidak perlu
                      keputusan. Item yang masih selisih diputuskan satu per satu di bawah; SO ini tertutup
                      otomatis begitu semua item selesai.
                    </p>
                  )}

                  {isFullSo && itemsEditable && reviewingId !== null ? (
                    <SOFullInputTable soId={reviewingId} onItemsChanged={refreshReviewData} />
                  ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produk</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">UOM</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                            System
                            <span className="block font-normal normal-case text-[10px] text-muted-foreground/70">
                              saat dihitung / kini
                            </span>
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Fisik</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Selisih</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Nilai Selisih</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Alasan</th>
                          {isFullSo && (
                            <>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hitung Ulang</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aksi</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reviewData.items.length === 0 ? (
                          <tr>
                            <td colSpan={isFullSo ? 10 : 7} className="px-4 py-8 text-center text-muted-foreground">
                              Belum ada item pada stock opname ini.
                            </td>
                          </tr>
                        ) : (
                          reviewData.items.map((item) => {
                            const draft = drafts[item.id] ?? toDraft(item)
                            const draftQty = Number(draft.physicalQty)
                            const qtyValid = draft.physicalQty.trim() !== '' && Number.isInteger(draftQty) && draftQty >= 0
                            // Selisih selalu turunan dari fisik − sistem, jadi ditampilkan
                            // live dari input dan tidak pernah diketik manual.
                            const previewVariance = qtyValid ? draftQty - item.systemQty : item.varianceQty
                            const dirty = isDraftDirty(item, draft)
                            // Untuk SO Besar, item yang sudah diputuskan (APPROVED/REJECTED)
                            // terkunci — stoknya sudah disesuaikan berdasarkan qty saat itu.
                            const rowEditable = itemsEditable && isItemDecidable(item.itemStatus)

                            return (
                              <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                                <td className="px-4 py-3 text-foreground">{item.productName}</td>
                                <td className="px-4 py-3 text-foreground">{item.uomCode}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                                  {item.systemQty}
                                  {liveStock[item.id] !== undefined && (
                                    <span
                                      className={`block text-[11px] font-normal ${
                                        liveStock[item.id] !== item.systemQty
                                          ? 'text-amber-600'
                                          : 'text-muted-foreground'
                                      }`}
                                    >
                                      kini: {liveStock[item.id]}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                                  {rowEditable ? (
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={draft.physicalQty}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.id]: { ...draft, physicalQty: e.target.value },
                                        }))
                                      }
                                      disabled={savingEdits}
                                      aria-label={`Qty fisik ${item.productName}`}
                                      aria-invalid={!qtyValid}
                                      className={`w-24 rounded-md border px-2 py-1 text-right text-sm tabular-nums bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 ${
                                        qtyValid ? 'border-input' : 'border-destructive'
                                      }`}
                                    />
                                  ) : (
                                    item.physicalQty
                                  )}
                                </td>
                                <td
                                  className={`px-4 py-3 text-right tabular-nums font-medium ${
                                    previewVariance > 0
                                      ? 'text-green-700'
                                      : previewVariance < 0
                                        ? 'text-destructive'
                                        : 'text-foreground'
                                  }`}
                                >
                                  {previewVariance > 0 ? `+${previewVariance}` : previewVariance}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                                  {dirty && qtyValid ? (
                                    <span className="text-xs text-muted-foreground italic">dihitung ulang saat disimpan</span>
                                  ) : (
                                    formatRupiah(item.varianceCostValue)
                                  )}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {rowEditable ? (
                                    <input
                                      type="text"
                                      value={draft.varianceReason}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [item.id]: { ...draft, varianceReason: e.target.value },
                                        }))
                                      }
                                      disabled={savingEdits}
                                      maxLength={500}
                                      placeholder="Alasan selisih"
                                      aria-label={`Alasan selisih ${item.productName}`}
                                      className="w-full min-w-40 rounded-md border border-input px-2 py-1 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                    />
                                  ) : (
                                    item.varianceReason?.trim() || '-'
                                  )}
                                </td>
                                {isFullSo && (
                                  <>
                                    <td className="px-4 py-3">
                                      <ItemStatusBadge status={item.itemStatus} />
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                      {item.isRecounted ? (
                                        <span>
                                          Fisik ke-2:{' '}
                                          <span className="font-medium text-foreground">
                                            {item.recountPhysicalQty}
                                          </span>
                                          {item.recountVarianceQty !== null && item.recountVarianceQty !== 0 && (
                                            <span className="text-destructive">
                                              {' '}
                                              (selisih{' '}
                                              {item.recountVarianceQty > 0
                                                ? `+${item.recountVarianceQty}`
                                                : item.recountVarianceQty}
                                              )
                                            </span>
                                          )}
                                        </span>
                                      ) : item.itemStatus === 'PENDING' ? (
                                        <span className="text-amber-600">belum dihitung ulang</span>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {item.itemStatus !== 'PENDING' ? (
                                        <span className="text-xs text-muted-foreground">
                                          {item.decisionNote?.trim() || '-'}
                                        </span>
                                      ) : rejectingItemId === item.id ? (
                                        <div className="min-w-48 space-y-1">
                                          <textarea
                                            value={itemRejectNote}
                                            onChange={(e) => setItemRejectNote(e.target.value)}
                                            placeholder="Alasan tolak (wajib)"
                                            rows={2}
                                            disabled={decideProcessingId !== null}
                                            aria-label={`Alasan tolak ${item.productName}`}
                                            className="w-full rounded-md border border-input px-2 py-1 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
                                          />
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              onClick={() => handleDecideItem(item.id, 'REJECT', itemRejectNote)}
                                              disabled={decideProcessingId !== null || !itemRejectNote.trim()}
                                              className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                              {decideProcessingId === item.id ? 'Memproses...' : 'Kirim'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setRejectingItemId(null)
                                                setItemRejectNote('')
                                              }}
                                              disabled={decideProcessingId !== null}
                                              className="px-2 py-1 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
                                            >
                                              Batal
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleDecideItem(item.id, 'APPROVE')}
                                            disabled={decideProcessingId !== null || dirty}
                                            title={dirty ? 'Simpan koreksi item terlebih dahulu' : undefined}
                                            className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                          >
                                            {decideProcessingId === item.id ? 'Memproses...' : 'Setujui'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRejectingItemId(item.id)
                                              setItemRejectNote('')
                                              setDecideError(null)
                                            }}
                                            disabled={decideProcessingId !== null}
                                            className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                          >
                                            Tolak
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-border px-5 py-4 flex items-center justify-end gap-2">
              <div className="mr-auto flex items-center gap-3 text-xs text-muted-foreground">
                {itemsEditable && dirtyCount > 0 && <span>{dirtyCount} item belum disimpan</span>}
                {isFullSo && reviewData?.header.status === 'PENDING' && (
                  <span>{pendingItemCount} item menunggu keputusan</span>
                )}
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Tutup
              </button>
              {itemsEditable && (
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={savingEdits || dirtyCount === 0 || processingId !== null}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingEdits ? 'Menyimpan...' : 'Simpan Koreksi'}
                </button>
              )}
              {/* SO Besar disetujui per item (tombol Setujui/Tolak di tiap baris) — tidak
                  ada lagi aksi "Setujui" satu-header di sini. */}
              {!isFullSo && reviewData?.header.status === 'PENDING' && reviewingId !== null && (
                <button
                  type="button"
                  onClick={() => handleApprove(reviewingId)}
                  disabled={processingId !== null || savingEdits || dirtyCount > 0}
                  title={dirtyCount > 0 ? 'Simpan koreksi item terlebih dahulu' : undefined}
                  className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {processingId === reviewingId ? 'Memproses...' : 'Setujui'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
