'use client'

import { useEffect } from 'react'
import type { BulkSaleDraft } from './bulk-sale-drafts'

type BulkSaleDraftsDrawerProps = {
  drafts: BulkSaleDraft[]
  currentBranchId: number
  canChangeBranch: boolean
  onResume: (draft: BulkSaleDraft) => void
  onDelete: (draft: BulkSaleDraft) => void
  onClose: () => void
}

function formatSavedAt(savedAt: string) {
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

export default function BulkSaleDraftsDrawer({
  drafts,
  currentBranchId,
  canChangeBranch,
  onResume,
  onDelete,
  onClose,
}: BulkSaleDraftsDrawerProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} role="presentation" />

      <div
        className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Daftar tunggu bulk sale"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Daftar Tunggu</h2>
            <p className="text-xs text-muted-foreground">Bulk sale yang ditahan di browser ini</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Tutup"
          >
            Tutup
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {drafts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
              <p>Belum ada bulk sale yang ditahan.</p>
              <p className="mt-1 text-xs">Tekan F8 saat mengisi transaksi untuk menahannya.</p>
            </div>
          ) : (
            drafts.map((draft) => {
              const isOtherBranch = draft.branchId !== currentBranchId
              const blocked = isOtherBranch && !canChangeBranch
              return (
                <div key={draft.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-foreground">{draft.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatSavedAt(draft.savedAt)} · {draft.branchName}
                      </p>
                      {draft.customerName && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">Customer: {draft.customerName}</p>
                      )}
                      {draft.source && (
                        <p className="mt-0.5 text-xs text-blue-700">
                          Dari {draft.source.kind === 'IBT' ? 'Internal PO' : 'Order Portal'} {draft.source.number}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(draft)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      aria-label={`Hapus draf ${draft.name}`}
                    >
                      Hapus
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
                    <div className="text-xs text-muted-foreground">
                      {draft.rows.length} produk · {draft.itemCount} qty ·{' '}
                      <span className="font-semibold text-foreground">Rp {draft.grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onResume(draft)}
                      disabled={blocked}
                      title={blocked ? `Draf ini milik cabang ${draft.branchName}` : undefined}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                    >
                      Lanjutkan
                    </button>
                  </div>

                  {isOtherBranch && (
                    <p className="mt-2 text-xs text-yellow-700">
                      {blocked
                        ? `Hanya bisa dilanjutkan dari cabang ${draft.branchName}.`
                        : `Melanjutkan draf ini akan memindahkan cabang ke ${draft.branchName}.`}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
