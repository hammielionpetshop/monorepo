'use client'

import { useState, useEffect } from 'react'
import type { Supplier, SupplierFormData } from './types'

interface Props {
  supplier?: Supplier | null
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

export default function SupplierForm({ supplier, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<SupplierFormData>({
    name: '',
    phone: '',
    email: '',
    contactPerson: '',
    bankAccount: '',
    address: '',
    paymentTermDays: '30',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name,
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        contactPerson: supplier.contactPerson ?? '',
        bankAccount: supplier.bankAccount ?? '',
        address: supplier.address ?? '',
        paymentTermDays: String(supplier.paymentTermDays ?? 30),
      })
    } else {
      setForm({ name: '', phone: '', email: '', contactPerson: '', bankAccount: '', address: '', paymentTermDays: '30' })
    }
  }, [supplier])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama supplier wajib diisi')
      return
    }

    const termDays = form.paymentTermDays.trim() === '' ? 30 : parseInt(form.paymentTermDays, 10)
    if (isNaN(termDays) || termDays < 0 || termDays > 365) {
      setErrorMsg('Termin pembayaran harus antara 0–365 hari')
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const url = supplier ? `/api/bo/master-data/suppliers/${supplier.id}` : '/api/bo/master-data/suppliers'
      const method = supplier ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          contactPerson: form.contactPerson.trim() || null,
          bankAccount: form.bankAccount.trim() || null,
          address: form.address.trim() || null,
          paymentTermDays: termDays,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal ${supplier ? 'memperbarui' : 'menyimpan'} supplier (${res.status})`)
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
        <label htmlFor="supplier-name" className="block text-sm font-medium text-foreground mb-1">
          Nama <span className="text-destructive">*</span>
        </label>
        <input
          id="supplier-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={100}
          placeholder="Contoh: PT Maju Jaya"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="supplier-contact-person" className="block text-sm font-medium text-foreground mb-1">
          Nama Kontak
        </label>
        <input
          id="supplier-contact-person"
          type="text"
          value={form.contactPerson}
          onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
          maxLength={100}
          placeholder="Contoh: Budi Santoso"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="supplier-phone" className="block text-sm font-medium text-foreground mb-1">
          Telepon
        </label>
        <input
          id="supplier-phone"
          type="text"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          maxLength={20}
          placeholder="Contoh: 08123456789"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="supplier-email" className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <input
          id="supplier-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          maxLength={255}
          placeholder="Contoh: supplier@email.com"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="supplier-bank-account" className="block text-sm font-medium text-foreground mb-1">
          Rekening Bank
        </label>
        <input
          id="supplier-bank-account"
          type="text"
          value={form.bankAccount}
          onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))}
          maxLength={100}
          placeholder="Contoh: BCA 1234567890 a/n PT Maju Jaya"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="supplier-address" className="block text-sm font-medium text-foreground mb-1">
          Alamat
        </label>
        <textarea
          id="supplier-address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          rows={3}
          placeholder="Alamat lengkap supplier"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <div>
        <label htmlFor="supplier-payment-term" className="block text-sm font-medium text-foreground mb-1">
          Termin Pembayaran (hari)
        </label>
        <input
          id="supplier-payment-term"
          type="number"
          min={0}
          max={365}
          value={form.paymentTermDays}
          onChange={(e) => setForm((f) => ({ ...f, paymentTermDays: e.target.value }))}
          placeholder="30"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-muted-foreground mt-1">Jumlah hari jatuh tempo pembayaran ke supplier</p>
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
          {isSubmitting ? 'Menyimpan...' : supplier ? 'Simpan Perubahan' : 'Tambah Supplier'}
        </button>
      </div>
    </form>
  )
}
