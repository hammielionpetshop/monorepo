'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { SOListItem, SOReviewData } from '../page'

interface Props {
  initialData: SOListItem[]
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

export default function SOClient({ initialData }: Props) {
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
  const approveAbortRef = useRef<AbortController | null>(null)
  const rejectAbortRef = useRef<AbortController | null>(null)
  const reviewAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setItems(initialData)
  }, [initialData])

  useEffect(() => {
    return () => {
      approveAbortRef.current?.abort()
      rejectAbortRef.current?.abort()
      reviewAbortRef.current?.abort()
    }
  }, [])

  function closeReviewModal() {
    reviewAbortRef.current?.abort()
    reviewAbortRef.current = null
    setReviewOpen(false)
    setReviewLoading(false)
    setReviewError(null)
    setReviewingId(null)
    setReviewData(null)
  }

  async function openReviewModal(id: number) {
    setReviewOpen(true)
    setReviewingId(id)
    setReviewLoading(true)
    setReviewError(null)
    setReviewData(null)

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
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setReviewError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setReviewLoading(false)
      if (reviewAbortRef.current === controller) reviewAbortRef.current = null
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

  const soColumns: ColumnDef<SOListItem>[] = [
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
      cell: ({ row }) => {
        const so = row.original
        return (
          <div className="text-center space-x-2">
            {rejectingId === so.id ? null : (
              <>
                <button
                  onClick={() => openReviewModal(so.id)}
                  disabled={processingId !== null || rejectingId !== null}
                  className="px-3 py-1 text-xs font-medium border border-border rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Review
                </button>
                {so.status === 'PENDING' && (
                  <button
                    onClick={() => handleApprove(so.id)}
                    disabled={processingId !== null || rejectingId !== null}
                    className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processingId === so.id ? 'Memproses...' : 'Setujui'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setRejectingId(so.id)
                    setRejectReason('')
                    setErrorMsg(null)
                  }}
                  disabled={processingId !== null}
                  className="px-3 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {so.status === 'DRAFT' ? 'Batalkan' : 'Tolak'}
                </button>
              </>
            )}
            {rejectingId === so.id && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={so.status === 'DRAFT' ? 'Alasan pembatalan (wajib)' : 'Alasan penolakan (wajib)'}
                  rows={2}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(so.id)}
                    disabled={processingId !== null || !rejectReason.trim()}
                    className="px-3 py-1 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processingId === so.id
                      ? 'Memproses...'
                      : so.status === 'DRAFT'
                        ? 'Kirim Pembatalan'
                        : 'Kirim Penolakan'}
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(null)
                      setRejectReason('')
                    }}
                    disabled={processingId !== null}
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
  ]

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

                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produk</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">UOM</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">System</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Fisik</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Selisih</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Nilai Selisih</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {reviewData.items.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                              Belum ada item pada stock opname ini.
                            </td>
                          </tr>
                        ) : (
                          reviewData.items.map((item) => (
                            <tr key={`${item.productId}-${item.uomId}`} className="hover:bg-accent/30 transition-colors">
                              <td className="px-4 py-3 text-foreground">{item.productName}</td>
                              <td className="px-4 py-3 text-foreground">{item.uomCode}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{item.systemQty}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">{item.physicalQty}</td>
                              <td
                                className={`px-4 py-3 text-right tabular-nums font-medium ${
                                  item.varianceQty > 0
                                    ? 'text-green-700'
                                    : item.varianceQty < 0
                                      ? 'text-destructive'
                                      : 'text-foreground'
                                }`}
                              >
                                {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-foreground">
                                {formatRupiah(item.varianceCostValue)}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{item.varianceReason?.trim() || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-border px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeReviewModal}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Tutup
              </button>
              {reviewData?.header.status === 'PENDING' && reviewingId !== null && (
                <button
                  type="button"
                  onClick={() => handleApprove(reviewingId)}
                  disabled={processingId !== null}
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
