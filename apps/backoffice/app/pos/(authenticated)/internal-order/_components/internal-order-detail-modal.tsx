'use client'

import { useEffect, useState } from 'react'
import { formatWIB } from '@petshop/shared'
import type { TransferDetail } from './types'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: 'Sedang Disiapkan', color: 'bg-indigo-100 text-indigo-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-orange-100 text-orange-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-amber-100 text-amber-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
}

interface Props {
  transferId: number
  onClose: () => void
}

export default function InternalOrderDetailModal({ transferId, onClose }: Props) {
  const [detail, setDetail] = useState<TransferDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setErrorMsg(null)
    fetch(`/api/bo/internal-transfers/${transferId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail')
        return data as TransferDetail
      })
      .then((data) => {
        if (active) setDetail(data)
      })
      .catch((err: unknown) => {
        if (active) setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat detail')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [transferId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const statusInfo = detail
    ? STATUS_LABELS[detail.status] ?? { label: detail.status, color: 'bg-gray-100 text-gray-600' }
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground font-mono">
              {detail?.ibtNumber ?? 'Detail PO Internal'}
            </h2>
            {detail && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatWIB(detail.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          {statusInfo && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          )}
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
          {loading && <p className="text-sm text-muted-foreground py-6 text-center">Memuat detail...</p>}

          {errorMsg && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
              {errorMsg}
            </div>
          )}

          {detail && !loading && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{detail.sourceBranchName ?? '-'}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium text-foreground">{detail.destinationBranchName ?? '-'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Pemohon</span>
                  <p className="font-medium text-foreground mt-0.5">{detail.requestedByName ?? '-'}</p>
                </div>
                {detail.approvedByName && (
                  <div>
                    <span className="text-muted-foreground">Disetujui Oleh</span>
                    <p className="font-medium text-foreground mt-0.5">{detail.approvedByName}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Est. Nilai Transfer</span>
                  <p className="font-medium text-foreground mt-0.5">
                    Rp {Number(detail.totalTransferValue).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Daftar Produk ({detail.items.length})
                </p>
                <table className="w-full text-xs border border-border rounded-md overflow-hidden">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Produk</th>
                      <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-14">Minta</th>
                      <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-14">Kirim</th>
                      <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-14">Terima</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-12">Sat.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          <div className="font-medium text-foreground">{item.productName ?? '-'}</div>
                          <div className="text-muted-foreground font-mono">{item.productSku ?? '-'}</div>
                          {item.receiveNotes && (
                            <div className="text-orange-600 mt-0.5">Catatan: {item.receiveNotes}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">{item.qtyRequested}</td>
                        <td className="px-2 py-1.5 text-right">
                          {item.qtyShipped > 0 ? item.qtyShipped : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {item.qtyReceived > 0 ? (
                            <span className={item.qtyReceived < item.qtyShipped ? 'text-orange-600' : 'text-green-600'}>
                              {item.qtyReceived}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{item.uomCode ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detail.notes && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Catatan: </span>
                  <span className="text-foreground">{detail.notes}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md text-foreground hover:bg-muted/50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
