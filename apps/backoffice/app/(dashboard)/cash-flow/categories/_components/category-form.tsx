'use client'

import { useState, useEffect } from 'react'
import {
  TYPE_LABELS, REPORT_KIND_LABELS, REPORT_KIND_HINTS, reportKindsFor,
  type CashFlowCategory, type CashFlowCategoryFormData, type CashFlowType,
} from './types'

interface Props {
  category?: CashFlowCategory | null
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

const emptyForm: CashFlowCategoryFormData = { name: '', type: 'EXPENSE', reportKind: 'COST', isActive: true, ownerOnly: false, noteRequired: false }

export default function CategoryForm({ category, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<CashFlowCategoryFormData>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name,
        type: category.type,
        reportKind: category.reportKind,
        isActive: category.isActive,
        ownerOnly: category.ownerOnly,
        noteRequired: category.noteRequired,
      })
    } else {
      setForm(emptyForm)
    }
  }, [category])

  const used = (category?.usedCount ?? 0) > 0
  const isSystem = category?.isSystem ?? false
  const typeLocked = isSystem || used
  // Jenis yang masih kosong boleh dipilih kapan saja; yang sudah terisi terkunci bila kategori sudah dipakai.
  const kindLocked = isSystem || (used && category?.reportKind !== null)

  function changeType(t: CashFlowType) {
    setForm((f) => ({ ...f, type: t, reportKind: reportKindsFor(t)[0] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) return setErrorMsg('Nama kategori wajib diisi')
    if (!form.reportKind && !category) return setErrorMsg('Jenis laporan wajib dipilih')

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const url = category ? `/api/bo/cash-flow/categories/${category.id}` : '/api/bo/cash-flow/categories'
      const method = category ? 'PATCH' : 'POST'
      const body = category
        ? { ...form, name: form.name.trim() }
        : { name: form.name.trim(), type: form.type, reportKind: form.reportKind, ownerOnly: form.ownerOnly, noteRequired: form.noteRequired }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        <label className="block text-sm font-medium text-foreground mb-1">
          Tipe <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['INCOME', 'EXPENSE'] as CashFlowType[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={typeLocked}
              onClick={() => changeType(t)}
              className={[
                'px-3 py-2 text-sm font-medium rounded-md border transition-colors disabled:cursor-not-allowed',
                form.type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent disabled:opacity-50',
              ].join(' ')}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="category-name" className="block text-sm font-medium text-foreground mb-1">
          Nama Kategori <span className="text-destructive">*</span>
        </label>
        <input
          id="category-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={50}
          placeholder="Contoh: Listrik"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-foreground mb-1">
          Jenis laporan <span className="text-destructive">*</span>
        </legend>
        <div className="space-y-1.5">
          {reportKindsFor(form.type).map((k) => (
            <label key={k} className={`flex items-start gap-2 text-sm ${kindLocked ? 'opacity-60' : 'cursor-pointer'}`}>
              <input
                type="radio"
                name="report-kind"
                checked={form.reportKind === k}
                disabled={kindLocked}
                onChange={() => setForm((f) => ({ ...f, reportKind: k }))}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{REPORT_KIND_LABELS[k]}</span>
                <span className="block text-xs text-muted-foreground">{REPORT_KIND_HINTS[k]}</span>
              </span>
            </label>
          ))}
        </div>
        {category && form.reportKind === null && (
          <p className="text-xs text-amber-700 mt-1">Kategori lama: jenis belum dipilih — pilih salah satu.</p>
        )}
        {kindLocked && !isSystem && (
          <p className="text-xs text-muted-foreground mt-1">
            Sudah dipakai {category?.usedCount} catatan, jadi tipe & jenis tidak bisa diganti. Buat kategori baru lalu nonaktifkan yang ini bila perlu.
          </p>
        )}
      </fieldset>

      {!isSystem && (
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.noteRequired} onChange={(e) => setForm((f) => ({ ...f, noteRequired: e.target.checked }))} />
            Catatan wajib diisi
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.ownerOnly} onChange={(e) => setForm((f) => ({ ...f, ownerOnly: e.target.checked }))} />
            Hanya Owner yang boleh mencatat
          </label>
          {category && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
              Aktif (bisa dipilih saat mencatat)
            </label>
          )}
        </div>
      )}
      {isSystem && <p className="text-xs text-muted-foreground">Kategori sistem dicatat otomatis; hanya namanya yang bisa diganti.</p>}

      {errorMsg && (
        <div role="alert" aria-live="assertive" className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
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
