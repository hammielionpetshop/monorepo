'use client'

import { useEffect, useRef, useState } from 'react'

type BulkSaleHoldDialogProps = {
  defaultName: string
  itemCount: number
  grandTotal: number
  onSave: (name: string) => void
  onCancel: () => void
}

export default function BulkSaleHoldDialog({
  defaultName,
  itemCount,
  grandTotal,
  onSave,
  onCancel,
}: BulkSaleHoldDialogProps) {
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  function save() {
    onSave(name.trim() || defaultName)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} role="presentation" />
      <div
        className="relative w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Tahan bulk sale"
      >
        <h2 className="text-base font-semibold text-foreground">Tahan Bulk Sale</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {itemCount} qty · Rp {grandTotal.toLocaleString('id-ID')} — disimpan di browser ini saja.
        </p>

        <label className="mt-4 mb-1 block text-xs font-medium text-foreground" htmlFor="bulk-sale-hold-name">
          Nama draf
        </label>
        <input
          id="bulk-sale-hold-name"
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
          }}
          maxLength={60}
          placeholder={defaultName}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tahan
          </button>
        </div>
      </div>
    </div>
  )
}
