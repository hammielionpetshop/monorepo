'use client'

import { useState, useEffect } from 'react'
import { formatWIB } from '@petshop/shared'
import type { ReturnDetail } from './types'

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(dateStr: string): string {
  return formatWIB(dateStr, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface Props {
  returnId: string
  returnNumber: string
  onClose: () => void
}

export default function ReturDetailModal({ returnId, returnNumber, onClose }: Props) {
  const [detail, setDetail] = useState<ReturnDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    let alive = true
    async function fetchDetail() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/bo/retur/${returnId}`)
        const data = await res.json()
        if (!alive) return
        if (!res.ok) {
          setError(data.error ?? 'Gagal mengambil detail retur')
          return
        }
        setDetail(data)
      } catch {
        if (alive) setError('Terjadi kesalahan jaringan')
      } finally {
        if (alive) setLoading(false)
      }
    }
    fetchDetail()
    return () => {
      alive = false
    }
  }, [returnId])

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail Retur ${returnNumber}`}
      >
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              Detail Retur: <span className="font-mono text-primary">{returnNumber}</span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label="Tutup Detail Retur"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Memuat detail retur...</p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center"
              >
                {error}
              </div>
            )}

            {!loading && !error && detail && (
              <>
                {detail.cancelledAt && (
                  <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <p className="font-semibold">Retur ini sudah dibatalkan</p>
                    <p className="mt-1 text-xs">
                      {formatDateTime(detail.cancelledAt)} oleh {detail.cancelledByName ?? '-'}
                      {detail.cancelReason ? ` — ${detail.cancelReason}` : ''}
                    </p>
                    <p className="mt-1 text-xs opacity-80">
                      Stok yang sempat dikembalikan sudah ditarik ulang saat pembatalan.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 border border-border/50 rounded-xl p-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Tanggal:</span>
                      <span className="font-medium text-foreground">{formatDateTime(detail.createdAt)}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">No. Transaksi:</span>
                      <span className="font-mono font-medium text-foreground">{detail.trxNumber}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Cabang:</span>
                      <span className="font-medium text-foreground">{detail.branchName}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Diproses oleh:</span>
                      <span className="font-medium text-foreground">{detail.processedByName}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Total Refund:</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatRupiah(detail.totalRefundAmount)}
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-muted-foreground w-28 flex-shrink-0">Status:</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          detail.cancelledAt
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {detail.cancelledAt ? 'Dibatalkan' : 'Aktif'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Alasan Retur
                  </h3>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 border border-border/50 rounded-lg px-4 py-3">
                    {detail.reason}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Item Diretur ({detail.items.length})
                  </h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border text-left">
                            <th className="px-4 py-2.5 font-medium text-muted-foreground">Produk</th>
                            <th className="px-4 py-2.5 font-medium text-muted-foreground text-right whitespace-nowrap">Qty</th>
                            <th className="px-4 py-2.5 font-medium text-muted-foreground text-right whitespace-nowrap">Harga Satuan</th>
                            <th className="px-4 py-2.5 font-medium text-muted-foreground text-right whitespace-nowrap">Refund</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.items.map(item => (
                            <tr key={item.id} className="border-b border-border/50 last:border-0">
                              <td className="px-4 py-3">
                                <div className="font-medium text-foreground">{item.productName}</div>
                                <div className="text-xs text-muted-foreground">{item.sku ?? '-'}</div>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                                {item.qty} <span className="text-xs text-muted-foreground">{item.uomName}</span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                                {formatRupiah(item.unitPrice)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">
                                {formatRupiah(item.refundAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/30 border-t border-border">
                            <td colSpan={3} className="px-4 py-3 text-right font-medium text-muted-foreground">
                              Total Refund
                            </td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground whitespace-nowrap">
                              {formatRupiah(detail.totalRefundAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end px-6 py-4 border-t border-border flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
