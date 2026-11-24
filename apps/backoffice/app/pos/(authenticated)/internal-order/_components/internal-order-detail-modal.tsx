'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatWIB } from '@petshop/shared'
import type { TransferDetail } from './types'
import InternalOrderEditForm from './internal-order-edit-form'
import ReceiveShortageNotice from './receive-shortage-notice'
import {
  RECEIVED_WITH_SHORTAGE_LABEL,
  isReceivedStatus,
  receiveShortQty,
  summarizeReceive,
} from '@/lib/ibt-receive-shortage'

const EDITABLE_STATUSES = ['DRAFT', 'PENDING_APPROVAL']

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: 'Sedang Disiapkan', color: 'bg-indigo-100 text-indigo-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-orange-100 text-orange-800' },
  PARTIALLY_RECEIVED: { label: RECEIVED_WITH_SHORTAGE_LABEL, color: 'bg-amber-100 text-amber-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
}

interface Props {
  transferId: number
  onClose: () => void
  onUpdated?: () => void
}

export default function InternalOrderDetailModal({ transferId, onClose, onUpdated }: Props) {
  const [detail, setDetail] = useState<TransferDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [savedMsg, setSavedMsg] = useState('')

  const loadDetail = useCallback(() => {
    setLoading(true)
    setErrorMsg(null)
    return fetch(`/api/bo/internal-transfers/${transferId}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail')
        return data as TransferDetail
      })
      .then((data) => {
        setDetail(data)
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat detail')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [transferId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const handleSaved = useCallback(
    (message: string) => {
      setMode('view')
      setSavedMsg(message)
      void loadDetail()
      onUpdated?.()
    },
    [loadDetail, onUpdated]
  )

  useEffect(() => {
    if (savedMsg) {
      const t = setTimeout(() => setSavedMsg(''), 4000)
      return () => clearTimeout(t)
    }
  }, [savedMsg])

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
  const received = detail ? isReceivedStatus(detail.status) : false
  const receiveSummary = detail && received ? summarizeReceive(detail.items) : null

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
                Dibuat {formatWIB(detail.createdAt, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {detail?.receivedAt && (
              <p className="text-xs text-muted-foreground">
                Diterima {formatWIB(detail.receivedAt, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {detail.receivedByName && <> oleh <span className="font-medium text-foreground">{detail.receivedByName}</span></>}
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

          {savedMsg && (
            <div
              role="status"
              aria-live="polite"
              className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm"
            >
              {savedMsg}
            </div>
          )}

          {detail && !loading && mode === 'edit' && (
            <InternalOrderEditForm
              transferId={detail.id}
              sourceBranchId={detail.sourceBranchId}
              sourceBranchName={detail.sourceBranchName ?? '-'}
              destinationBranchId={detail.destinationBranchId}
              destinationBranchName={detail.destinationBranchName ?? '-'}
              items={detail.items}
              onCancel={() => setMode('view')}
              onSaved={handleSaved}
            />
          )}

          {detail && !loading && mode === 'view' && (
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
                {!receiveSummary && (
                  <div>
                    <span className="text-muted-foreground">Est. Nilai Transfer</span>
                    <p className="font-medium text-foreground mt-0.5">
                      Rp {Number(detail.totalTransferValue).toLocaleString('id-ID')}
                    </p>
                  </div>
                )}
              </div>

              {receiveSummary && (
                <div className="rounded-md border border-border text-xs divide-y divide-border">
                  <div className="flex justify-between px-3 py-1.5">
                    <span className="text-muted-foreground">Nilai Dikirim</span>
                    <span className="tabular-nums">Rp {receiveSummary.shippedValue.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 bg-primary/5">
                    <span className="font-medium text-foreground">
                      Nilai Diterima <span className="font-normal text-muted-foreground">— yang ditagih ke {detail.destinationBranchName ?? 'cabang tujuan'}</span>
                    </span>
                    <span className="font-bold tabular-nums">Rp {receiveSummary.receivedValue.toLocaleString('id-ID')}</span>
                  </div>
                  {receiveSummary.shortageValue > 0 && (
                    <div className="flex justify-between px-3 py-1.5">
                      <span className="text-amber-700 dark:text-amber-400">
                        Tidak Diterima <span className="text-muted-foreground">— tidak ditagih</span>
                      </span>
                      <span className="tabular-nums text-amber-700 dark:text-amber-400">
                        Rp {receiveSummary.shortageValue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {received && (
                <ReceiveShortageNotice
                  items={detail.items}
                  sourceBranchName={detail.sourceBranchName}
                  shortageReturns={detail.shortageReturns ?? []}
                />
              )}

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
                      {received && (
                        <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-14">Selisih</th>
                      )}
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-12">Sat.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => {
                      const shortQty = received ? receiveShortQty(item) : 0
                      return (
                      <tr
                        key={item.id}
                        className={`border-t border-border ${shortQty > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}
                      >
                        <td className="px-3 py-1.5">
                          <div className="font-medium text-foreground">{item.productName ?? '-'}</div>
                          <div className="text-muted-foreground font-mono">{item.productSku ?? '-'}</div>
                          {item.receiveNotes && (
                            <div className="text-orange-600 mt-0.5">Catatan penerima: {item.receiveNotes}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">{item.qtyRequested}</td>
                        <td className="px-2 py-1.5 text-right">
                          {item.qtyShipped > 0 ? item.qtyShipped : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {item.qtyReceived > 0 || (received && item.qtyShipped > 0) ? (
                            <span className={item.qtyReceived < item.qtyShipped ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                              {item.qtyReceived}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        {received && (
                          <td className="px-2 py-1.5 text-right">
                            {shortQty > 0 ? (
                              <span className="font-semibold text-orange-600">-{shortQty}</span>
                            ) : item.qtyShipped > 0 ? (
                              <span className="text-green-600" aria-label="cocok">✓</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-muted-foreground">{item.uomCode ?? '-'}</td>
                      </tr>
                      )
                    })}
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

        {mode === 'view' && (
          <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
            {detail && EDITABLE_STATUSES.includes(detail.status) && (
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                + Tambah Produk
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md text-foreground hover:bg-muted/50 transition-colors"
            >
              Tutup
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
