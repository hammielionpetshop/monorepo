'use client'

import { X, TriangleAlert } from 'lucide-react'
import type { RatioChangePlan } from './types'

interface Props {
  changes: RatioChangePlan[]
  onConfirm: () => void
  onCancel: () => void
  isSaving: boolean
}

export default function GlobalRatioConfirmDialog({ changes, onConfirm, onCancel, isSaving }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <TriangleAlert className="w-4 h-4 text-amber-600" />
            Konfirmasi Perubahan Ratio (GLOBAL)
          </h2>
          <button onClick={onCancel} disabled={isSaving} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Ratio konversi berlaku untuk <strong className="text-foreground">semua cabang</strong>.
            Perubahan berikut akan memengaruhi arti harga yang sudah ada di cabang lain:
          </p>
          <ul className="space-y-2">
            {changes.map((c) => (
              <li
                key={`${c.productId}:${c.uomId}`}
                className="p-3 rounded-md border border-amber-300 bg-amber-50 text-sm"
              >
                <p className="font-medium text-foreground">
                  {c.productName} — {c.uomCode}
                </p>
                <p className="text-amber-800">
                  Ratio <strong>{c.oldRatio ?? '-'}</strong> → <strong>{c.newRatio}</strong>
                </p>
                {c.branches.length > 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    Harga satuan ini sudah diatur di: {c.branches.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan...' : `Ya, Ubah untuk Semua Cabang (${changes.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
