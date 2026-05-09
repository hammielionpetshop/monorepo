'use client'

import { useState, useEffect } from 'react'
import type { Category, CategoryFormData } from './types'

interface Props {
  category?: Category | null
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

export default function CategoryForm({ category, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<CategoryFormData>({ name: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (category) {
      setForm({ name: category.name })
    } else {
      setForm({ name: '' })
    }
  }, [category])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama kategori wajib diisi')
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const url = category
        ? `/api/bo/master-data/categories/${category.id}`
        : '/api/bo/master-data/categories'
      const method = category ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal ${category ? 'memperbarui' : 'menyimpan'} kategori (${res.status})`)
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
        <label htmlFor="category-name" className="block text-sm font-medium text-foreground mb-1">
          Nama Kategori <span className="text-destructive">*</span>
        </label>
        <input
          id="category-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ name: e.target.value })}
          maxLength={50}
          placeholder="Contoh: Makanan Hewan"
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
          {isSubmitting ? 'Menyimpan...' : category ? 'Simpan Perubahan' : 'Tambah Kategori'}
        </button>
      </div>
    </form>
  )
}
