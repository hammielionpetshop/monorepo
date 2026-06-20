'use client'

import { useState, useEffect } from 'react'
import { PAYMENT_METHOD_TYPE_OPTIONS } from './types'
import type { PaymentMethod, PaymentMethodFormData } from './types'

interface Props {
  paymentMethod?: PaymentMethod | null
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

export default function PaymentMethodForm({ paymentMethod, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<PaymentMethodFormData>({ name: '', type: 'CASH' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (paymentMethod) {
      setForm({ name: paymentMethod.name, type: paymentMethod.type })
    } else {
      setForm({ name: '', type: 'CASH' })
    }
  }, [paymentMethod])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama metode pembayaran wajib diisi')
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const url = paymentMethod
        ? `/api/bo/master-data/payment-methods/${paymentMethod.id}`
        : '/api/bo/master-data/payment-methods'
      const method = paymentMethod ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal ${paymentMethod ? 'memperbarui' : 'menyimpan'} metode pembayaran (${res.status})`)
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
        <label htmlFor="pm-name" className="block text-sm font-medium text-foreground mb-1">
          Nama <span className="text-destructive">*</span>
        </label>
        <input
          id="pm-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={50}
          placeholder="Contoh: Tunai, GoPay, BCA Transfer"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="pm-type" className="block text-sm font-medium text-foreground mb-1">
          Tipe <span className="text-destructive">*</span>
        </label>
        <select
          id="pm-type"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PaymentMethodFormData['type'] }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {PAYMENT_METHOD_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
          {isSubmitting ? 'Menyimpan...' : paymentMethod ? 'Simpan Perubahan' : 'Tambah Metode Pembayaran'}
        </button>
      </div>
    </form>
  )
}
