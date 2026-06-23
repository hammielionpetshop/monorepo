'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatWIB } from '@petshop/shared'
import type { BranchOption, TransferListItem } from './types'
import InternalOrderForm from './internal-order-form'
import InternalOrderDetailModal from './internal-order-detail-modal'

interface InternalOrderClientProps {
  currentBranchId: number
  otherBranches: BranchOption[]
  allBranches: BranchOption[]
  userRole: string
  initialTransfers: TransferListItem[]
}

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

export default function InternalOrderClient({
  currentBranchId,
  otherBranches,
  allBranches,
  userRole,
  initialTransfers,
}: InternalOrderClientProps) {
  const [view, setView] = useState<'list' | 'create'>('list')
  const [transfers, setTransfers] = useState<TransferListItem[]>(initialTransfers)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  const refreshList = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch(
        `/api/bo/internal-transfers?destinationBranchId=${currentBranchId}&limit=50`
      )
      if (res.ok) {
        const data: TransferListItem[] = await res.json()
        setTransfers(data)
      }
    } finally {
      setRefreshing(false)
    }
  }, [currentBranchId])

  const handleCreated = useCallback(
    (message: string) => {
      setSuccessMsg(message)
      setView('list')
      void refreshList()
    },
    [refreshList]
  )

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">PO Internal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {view === 'list'
              ? 'Daftar permintaan transfer stok yang dibuat cabang ini'
              : 'Buat permintaan transfer stok dari cabang lain'}
          </p>
        </div>
        {view === 'list' ? (
          <button
            type="button"
            onClick={() => setView('create')}
            className="flex-shrink-0 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            + Buat PO Internal
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setView('list')}
            className="flex-shrink-0 px-4 py-2 text-sm border border-border rounded-md text-foreground hover:bg-muted/50 transition-colors"
          >
            ← Kembali ke daftar
          </button>
        )}
      </div>

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm"
        >
          {successMsg}
        </div>
      )}

      {view === 'create' ? (
        <InternalOrderForm
          currentBranchId={currentBranchId}
          otherBranches={otherBranches}
          allBranches={allBranches}
          userRole={userRole}
          onCreated={handleCreated}
        />
      ) : transfers.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg py-12 text-center text-muted-foreground text-sm">
          Belum ada PO internal yang dibuat di cabang ini.
        </div>
      ) : (
        <div className="space-y-2">
          {transfers.map((t) => {
            const statusInfo = STATUS_LABELS[t.status] ?? {
              label: t.status,
              color: 'bg-gray-100 text-gray-600',
            }
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailId(t.id)}
                className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/50 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm text-foreground">{t.ibtNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Dari: <span className="font-medium">{t.sourceBranchName ?? '-'}</span>
                      {' · '}
                      {formatWIB(t.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-foreground">
                      Rp {Number(t.totalTransferValue).toLocaleString('id-ID')}
                    </p>
                    <p className="text-xs text-muted-foreground">Lihat detail →</p>
                  </div>
                </div>
              </button>
            )
          })}
          {refreshing && (
            <p className="text-xs text-muted-foreground text-center py-1">Memperbarui daftar...</p>
          )}
        </div>
      )}

      {detailId !== null && (
        <InternalOrderDetailModal transferId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}
