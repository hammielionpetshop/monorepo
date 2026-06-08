'use client'

import { useState, useEffect } from 'react'
import type { Customer, CustomerFormData } from './types'

interface Props {
  customer?: Customer | null
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

export default function CustomerForm({ customer, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<CustomerFormData>({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (customer) {
      setForm({
        code: customer.code ?? '',
        name: customer.name,
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
      })
    } else {
      setForm({ code: '', name: '', phone: '', email: '', address: '' })
    }
  }, [customer])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama customer wajib diisi')
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const url = customer ? `/api/bo/customers/${customer.id}` : '/api/bo/customers'
      const method = customer ? 'PUT' : 'POST'

      const body: Record<string, string | boolean | null> = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
      }

      if (!customer) {
        body.code = form.code.trim() || undefined as unknown as null
      } else {
        body.code = form.code.trim() || null
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal ${customer ? 'memperbarui' : 'menyimpan'} customer (${res.status})`)
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
        <label htmlFor="customer-code" className="block text-sm font-medium text-foreground mb-1">
          Kode Customer
        </label>
        <input
          id="customer-code"
          type="text"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          maxLength={20}
          placeholder="Kosongkan untuk auto-generate"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="customer-name" className="block text-sm font-medium text-foreground mb-1">
          Nama <span className="text-destructive">*</span>
        </label>
        <input
          id="customer-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={100}
          placeholder="Contoh: Budi Santoso"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="customer-phone" className="block text-sm font-medium text-foreground mb-1">
          Telepon
        </label>
        <input
          id="customer-phone"
          type="text"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          maxLength={20}
          placeholder="Contoh: 08123456789"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="customer-email" className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <input
          id="customer-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          maxLength={255}
          placeholder="Contoh: budi@email.com"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="customer-address" className="block text-sm font-medium text-foreground mb-1">
          Alamat
        </label>
        <textarea
          id="customer-address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          rows={3}
          placeholder="Alamat lengkap customer"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
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
          {isSubmitting ? 'Menyimpan...' : customer ? 'Simpan Perubahan' : 'Tambah Customer'}
        </button>
      </div>
    </form>
  )
}
