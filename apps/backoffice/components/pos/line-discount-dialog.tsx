'use client'

import { useEffect, useRef, useState } from 'react'
import { RequiredChoiceDialog, type RequiredChoiceAction } from '@/components/ui/required-choice-dialog'
import {
  MANUAL_DISCOUNT_NOTE_MAX,
  MANUAL_DISCOUNT_OTHER_REASON,
  MANUAL_DISCOUNT_REASONS,
  lineGrossAmount,
  resolveManualDiscount,
  type ManualDiscountEntry,
  type ManualDiscountMode,
} from '@/lib/manual-discount'
import { useShortcutLock } from './shortcut-lock'

interface LineDiscountDialogProps {
  productName: string
  qty: number
  unitPrice: string
  /** Isian yang sudah terpasang di baris ini (popup dibuka untuk mengubah / menghapus). */
  current?: ManualDiscountEntry
  onSave: (entry: ManualDiscountEntry) => void
  onRemove: () => void
  onClose: () => void
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

/**
 * Popup Diskon per barang (wajib dijawab): besar potongan + alasan. Hitungan dan aturannya
 * seluruhnya dari mesin diskon manual (`lib/manual-discount.ts`) — sama dengan yang diperiksa server.
 */
export default function LineDiscountDialog({ productName, qty, unitPrice, current, onSave, onRemove, onClose }: LineDiscountDialogProps) {
  // Popup ini butuh keyboard — scanner & shortcut latar kasir tidak boleh jalan di belakangnya.
  useShortcutLock()

  const [mode, setMode] = useState<ManualDiscountMode>(current?.mode ?? 'PER_PCS')
  const [value, setValue] = useState(current ? String(current.value) : '')
  const [reasonCode, setReasonCode] = useState(current?.reasonCode ?? '')
  const [reasonNote, setReasonNote] = useState(current?.reasonNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const valueInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => valueInput.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [])

  const lineGross = lineGrossAmount(qty, unitPrice)
  const entry: ManualDiscountEntry = { mode, value: Number(value || 0), reasonCode, reasonNote: reasonNote.trim() || null }
  const { amount } = resolveManualDiscount(entry, qty, unitPrice)

  function save() {
    const checked = resolveManualDiscount(entry, qty, unitPrice)
    if (checked.error) return setError(checked.error)
    onSave(entry)
  }

  const actions: RequiredChoiceAction[] = [
    { label: 'Batal', variant: 'secondary', onClick: onClose },
    ...(current ? [{ label: 'Hapus diskon', variant: 'destructive' as const, onClick: onRemove }] : []),
    { label: 'Pasang diskon', variant: 'primary', onClick: save },
  ]

  const inputClass =
    'w-full min-h-[44px] rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <RequiredChoiceDialog title="Diskon barang" actions={actions}>
      <p className="font-medium leading-snug">{productName}</p>
      <p className="text-xs text-muted-foreground">
        {qty} × {rupiah(Number(unitPrice))} = {rupiah(lineGross)}
      </p>

      <div className="grid grid-cols-2 gap-2 pt-1">
        {([
          ['PER_PCS', 'Potongan per pcs'],
          ['PER_BARIS', 'Potongan untuk barang ini'],
        ] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            aria-pressed={mode === m}
            className={`min-h-[44px] rounded-lg border px-2 text-xs font-semibold transition-colors ${
              mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="line-discount-value" className="mb-1 block text-xs font-medium">
          {mode === 'PER_PCS' ? 'Potongan per pcs (Rp) *' : 'Potongan untuk barang ini (Rp) *'}
        </label>
        <input
          id="line-discount-value"
          ref={valueInput}
          type="text"
          inputMode="numeric"
          value={value ? Number(value).toLocaleString('id-ID') : ''}
          onChange={(e) => { setValue(e.target.value.replace(/\D/g, '').slice(0, 12)); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
          placeholder="mis. 2.000"
          className={`${inputClass} font-semibold tabular-nums`}
        />
      </div>

      <div>
        <label htmlFor="line-discount-reason" className="mb-1 block text-xs font-medium">Alasan *</label>
        <select
          id="line-discount-reason"
          value={reasonCode}
          onChange={(e) => { setReasonCode(e.target.value); setError(null) }}
          className={inputClass}
        >
          <option value="">-- Pilih alasan --</option>
          {MANUAL_DISCOUNT_REASONS.map((r) => (
            <option key={r.code} value={r.code}>{r.label}</option>
          ))}
        </select>
      </div>

      {reasonCode === MANUAL_DISCOUNT_OTHER_REASON && (
        <div>
          <label htmlFor="line-discount-note" className="mb-1 block text-xs font-medium">Tulis alasannya *</label>
          <input
            id="line-discount-note"
            type="text"
            maxLength={MANUAL_DISCOUNT_NOTE_MAX}
            value={reasonNote}
            onChange={(e) => { setReasonNote(e.target.value); setError(null) }}
            className={inputClass}
          />
        </div>
      )}

      {amount > 0 && amount <= lineGross && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Potongan</span>
            <span className="font-semibold text-orange-600 tabular-nums">−{rupiah(amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dibayar untuk barang ini</span>
            <span className="font-bold tabular-nums">{rupiah(lineGross - amount)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
    </RequiredChoiceDialog>
  )
}
