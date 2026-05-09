'use client'

import { useState, useEffect } from 'react'
import type { Uom, UomFormData } from './types'

interface Props {
  uom?: Uom | null
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

export default function UomForm({ uom, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<UomFormData>({ code: '', name: '', isBase: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (uom) {
      setForm({ code: uom.code, name: uom.name, isBase: uom.isBase })
    } else {
      setForm({ code: '', name: '', isBase: false })
    }
  }, [uom])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.code.trim()) {
      setErrorMsg('Kode satuan ukur wajib diisi')
      return
    }
    if (!form.name.trim()) {
      setErrorMsg('Nama satuan ukur wajib diisi')
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const url = uom ? `/api/bo/master-data/uom/${uom.id}` : '/api/bo/master-data/uom'
      const method = uom ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          isBase: form.isBase,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal ${uom ? 'memperbarui' : 'menyimpan'} satuan ukur (${res.status})`)
        return
      }

      setIsSubmitting(false)
      onSubmittingChange?.(false)
      onSuccess()
      return
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="uom-code" className="block text-sm font-medium text-foreground mb-1">
          Kode <span className="text-destructive">*</span>
        </label>
        <input
          id="uom-code"
          type="text"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
          maxLength={10}
          placeholder="Contoh: KG"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
        />
      </div>

      <div>
        <label htmlFor="uom-name" className="block text-sm font-medium text-foreground mb-1">
          Nama <span className="text-destructive">*</span>
        </label>
        <input
          id="uom-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={50}
          placeholder="Contoh: Kilogram"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="uom-isBase"
          type="checkbox"
          checked={form.isBase}
          onChange={(e) => setForm((f) => ({ ...f, isBase: e.target.checked }))}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
        />
        <label htmlFor="uom-isBase" className="text-sm font-medium text-foreground">
          Satuan Dasar
        </label>
        <span className="text-xs text-muted-foreground">(centang jika ini adalah UOM dasar untuk produk)</span>
      </div>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : uom ? 'Simpan Perubahan' : 'Tambah Satuan Ukur'}
        </button>
      </div>
    </form>
  )
}
