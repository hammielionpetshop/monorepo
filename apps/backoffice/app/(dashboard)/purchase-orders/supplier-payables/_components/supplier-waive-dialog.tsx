'use client'

import { useState } from 'react'

export interface WaiveTarget {
  id: number
  poNumber: string
  supplierName: string | null
  amount: number
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

/** Bebaskan hutang supplier: tagihan direlakan tanpa uang keluar, alasan wajib, tidak bisa dibatalkan. */
export function SupplierWaiveDialog({
  target,
  onClose,
  onSaved,
}: {
  target: WaiveTarget
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 5) {
      setError('Alasan wajib diisi (minimal 5 huruf)')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/supplier-payables/${target.id}/waive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `Gagal membebaskan hutang (${res.status})`)
        return
      }
      onSaved(`Hutang ${target.poNumber} dibebaskan`)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={saving ? undefined : onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="waive-title"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4"
      >
        <div>
          <h3 id="waive-title" className="text-base font-semibold text-foreground">Bebaskan Hutang Supplier</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {target.supplierName ?? '-'} · <span className="font-mono">{target.poNumber}</span>
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          Tagihan yang dibebaskan: <span className="font-semibold">{rupiah(target.amount)}</span>
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
          <p>Hutang ini menjadi <span className="font-semibold">Dihapus</span>: tidak ada uang keluar dan tidak tercatat di Arus Kas.</p>
          <p>Barang, stok, modal, dan nilai PO tetap tercatat. Langkah ini <span className="font-semibold">tidak bisa dibatalkan</span>.</p>
        </div>

        <div>
          <label htmlFor="waive-reason" className="block text-xs font-medium text-muted-foreground mb-1">
            Alasan <span className="text-destructive">*</span>
          </label>
          <textarea
            id="waive-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="mis. Barang retur modal owner ke rekan, sebelum sistem berjalan"
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Bebaskan Hutang'}
          </button>
        </div>
      </form>
    </div>
  )
}
