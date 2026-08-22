'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { UomGroup, UomOption } from './types'

interface Props {
  productId: number
  group: UomGroup
  uoms: UomOption[]
  onClose: () => void
  onSuccess: () => void
}

export default function MoveModal({ productId, group, uoms, onClose, onSuccess }: Props) {
  const targetOptions = uoms.filter((u) => u.id !== group.uomId)
  const [toUomId, setToUomId] = useState<number>(targetOptions[0]?.id ?? 0)
  const [ratio, setRatio] = useState<string>('1')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const ratioNum = Number(ratio)
  const ratioValid = Number.isInteger(ratioNum) && ratioNum > 0
  const toUom = targetOptions.find((u) => u.id === toUomId)

  const previewQty = ratioValid && group.stock ? group.stock.qty * ratioNum : null
  const previewBatches = ratioValid
    ? group.batches.map((b) => ({
        id: b.id,
        qtyRemaining: b.qtyRemaining * ratioNum,
        costPrice: Math.round(b.costPrice / ratioNum),
      }))
    : []

  async function handleSubmit() {
    if (!ratioValid) {
      setErrorMsg('Rasio harus bilangan bulat positif')
      return
    }
    if (!toUomId) {
      setErrorMsg('Pilih satuan tujuan')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/bo/inventory/stock-uom/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          branchId: group.branchId,
          fromUomId: group.uomId,
          toUomId,
          ratio: ratioNum,
        }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal memindahkan stok')
      onSuccess()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Pindahkan Stok ke Satuan Lain</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-muted/40 rounded-md px-3 py-2 text-sm">
            <span className="text-muted-foreground">Cabang: </span>
            <span className="font-medium text-foreground">{group.branchName}</span>
            <span className="text-muted-foreground"> · Satuan asal: </span>
            <span className="font-medium text-foreground">{group.uomCode}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Satuan tujuan</label>
            <select
              value={toUomId}
              onChange={(e) => setToUomId(Number(e.target.value))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            >
              {targetOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              1 {group.uomCode} = ___ {toUom?.code ?? '?'}
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              className="w-32 border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Rasio konversi antara satuan lama dan satuan baru untuk produk ini.
            </p>
          </div>

          <div className="bg-muted/40 rounded-md px-3 py-2.5 text-sm space-y-1">
            {ratioValid ? (
              <>
                {group.stock && (
                  <p>
                    <span className="text-muted-foreground">Qty stok: </span>
                    <span className="font-medium text-foreground">{group.stock.qty} {group.uomCode}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium text-foreground">{previewQty} {toUom?.code}</span>
                  </p>
                )}
                {previewBatches.length > 0 && (
                  <div className="text-muted-foreground">
                    <p>{previewBatches.length} batch akan ikut dikonversi:</p>
                    <ul className="mt-1 space-y-0.5">
                      {previewBatches.map((b) => (
                        <li key={b.id}>
                          Batch #{b.id}: sisa {b.qtyRemaining} {toUom?.code}, modal Rp{b.costPrice.toLocaleString('id-ID')}/{toUom?.code}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!group.stock && group.batches.length === 0 && (
                  <p className="text-muted-foreground">Tidak ada stok/batch untuk dipindahkan.</p>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Masukkan rasio untuk melihat pratinjau.</span>
            )}
          </div>

          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !ratioValid || (!group.stock && group.batches.length === 0)}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Memindahkan...' : 'Pindahkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
