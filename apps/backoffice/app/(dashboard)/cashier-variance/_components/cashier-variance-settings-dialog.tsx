'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { validateCashierVarianceSettings, type CashierVarianceSettings } from '@/lib/cashier-variance'

interface Props {
  initial: CashierVarianceSettings
  onClose: () => void
  onSaved: () => void
}

function toInt(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function formatInput(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}

export default function CashierVarianceSettingsDialog({ initial, onClose, onSaved }: Props) {
  const [tolerance, setTolerance] = useState(initial.tolerance)
  const [anomalyThreshold, setAnomalyThreshold] = useState(initial.anomalyThreshold)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const next = { tolerance, anomalyThreshold }
    const problem = validateCashierVarianceSettings(next)
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/bo/cashier-variance/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Gagal menyimpan pengaturan')
        return
      }
      onSaved()
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold text-foreground">Pengaturan Toleransi Selisih</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm">
          <label className="block">
            <span className="mb-1 block text-foreground">Batas toleransi</span>
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Selisih minus atau plus yang nilainya di bawah batas ini tidak dibebankan ke kasir.
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rp</span>
              <input
                inputMode="numeric"
                value={formatInput(tolerance)}
                onChange={(e) => setTolerance(toInt(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-right tabular-nums"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-foreground">Batas tak wajar</span>
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Selisih sebesar ini atau lebih dianggap kemungkinan salah ketik verifikasi — ditampilkan terpisah dan tidak dibagi ke kasir.
            </span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rp</span>
              <input
                inputMode="numeric"
                value={formatInput(anomalyThreshold)}
                onChange={(e) => setAnomalyThreshold(toInt(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-right tabular-nums"
              />
            </div>
          </label>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Perubahan tercatat di jejak audit dan langsung berlaku untuk semua bulan.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">
            Batal
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
