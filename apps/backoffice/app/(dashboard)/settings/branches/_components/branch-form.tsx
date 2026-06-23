'use client'

import { useState, useEffect } from 'react'
import type { BranchListItem, BranchFormData } from './types'

interface Props {
  branch: BranchListItem
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

export default function BranchForm({ branch, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<BranchFormData>({
    name: '',
    receiptName: '',
    address: '',
    phone: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    setForm({
      name: branch.name,
      receiptName: branch.receiptName ?? 'HAMMIELION',
      address: branch.address ?? '',
      phone: branch.phone ?? '',
    })
  }, [branch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama wajib diisi')
      return
    }

    if (!form.receiptName.trim()) {
      setErrorMsg('Nama di struk wajib diisi')
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    let success = false
    try {
      const body: Record<string, unknown> = {}
      const trimmedName = form.name.trim()
      if (trimmedName !== branch.name) body.name = trimmedName

      const trimmedReceiptName = form.receiptName.trim()
      if (trimmedReceiptName !== branch.receiptName) body.receiptName = trimmedReceiptName

      const normalizedAddress = form.address.trim() || null
      if (normalizedAddress !== branch.address) body.address = normalizedAddress

      const normalizedPhone = form.phone.trim() || null
      if (normalizedPhone !== branch.phone) body.phone = normalizedPhone

      const res = await fetch(`/api/bo/settings/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal memperbarui cabang (${res.status})`)
        return
      }

      success = true
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
    if (success) onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="branch-code" className="block text-sm font-medium text-foreground mb-1">
          Kode Cabang
        </label>
        <input
          id="branch-code"
          type="text"
          value={branch?.code ?? ''}
          readOnly
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
        />
      </div>

      <div>
        <label htmlFor="branch-name" className="block text-sm font-medium text-foreground mb-1">
          Nama <span className="text-destructive">*</span>
        </label>
        <input
          id="branch-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={100}
          placeholder="Nama cabang"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="branch-receipt-name" className="block text-sm font-medium text-foreground mb-1">
          Nama di Struk <span className="text-destructive">*</span>
        </label>
        <input
          id="branch-receipt-name"
          type="text"
          value={form.receiptName}
          onChange={(e) => setForm((f) => ({ ...f, receiptName: e.target.value }))}
          maxLength={100}
          placeholder="HAMMIELION"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Teks header besar di struk penjualan & settlement. Default: HAMMIELION.
        </p>
      </div>

      <div>
        <label htmlFor="branch-address" className="block text-sm font-medium text-foreground mb-1">
          Alamat
        </label>
        <input
          id="branch-address"
          type="text"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          maxLength={500}
          placeholder="Alamat cabang (opsional)"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="branch-phone" className="block text-sm font-medium text-foreground mb-1">
          Telepon
        </label>
        <input
          id="branch-phone"
          type="text"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          maxLength={20}
          placeholder="Nomor telepon (opsional)"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
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
          {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  )
}