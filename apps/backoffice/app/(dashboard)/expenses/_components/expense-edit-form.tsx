'use client'

import { useState } from 'react'
import type { Option, ShiftExpense } from './types'

interface Props {
  expense: ShiftExpense
  categories: Option[]
  onClose: () => void
  onSaved: () => void
}

const MAX_AMOUNT = 2147483647

export default function ExpenseEditForm({ expense, categories, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(String(expense.amount))
  const [note, setNote] = useState(expense.note)
  const [categoryId, setCategoryId] = useState(expense.categoryId ? String(expense.categoryId) : '')
  const [categoryCustom, setCategoryCustom] = useState(expense.categoryCustom ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanNote = note.trim()
    if (!cleanNote) {
      setError('Catatan wajib diisi')
      return
    }

    const amountInt = parseInt(amount, 10)
    if (isNaN(amountInt) || amountInt <= 0) {
      setError('Jumlah harus lebih dari 0')
      return
    }
    if (amountInt > MAX_AMOUNT) {
      setError('Jumlah pengeluaran melebihi batas maksimum yang diperbolehkan')
      return
    }

    const cleanCustom = categoryCustom.trim()
    if (!categoryId && !cleanCustom) {
      setError('Pilih kategori atau isi kategori bebas')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/bo/shift-expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInt,
          note: cleanNote,
          categoryId: categoryId ? parseInt(categoryId, 10) : null,
          categoryCustom: categoryId ? null : cleanCustom,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal menyimpan perubahan')
        return
      }
      onSaved()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Ubah Pengeluaran</h3>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-muted-foreground hover:text-foreground text-xl leading-none disabled:opacity-40"
            aria-label="Tutup"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Shift #{expense.shiftNumber} · {expense.branchName ?? '-'} ·{' '}
            {expense.cashierName ?? `Kasir #${expense.cashierId}`}
          </p>

          <div>
            <label htmlFor="expense-category" className="block text-sm font-medium text-foreground mb-1">
              Kategori
            </label>
            <select
              id="expense-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isSaving}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            >
              <option value="">— Kategori bebas —</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {!categoryId && (
            <div>
              <label htmlFor="expense-category-custom" className="block text-sm font-medium text-foreground mb-1">
                Kategori Bebas
              </label>
              <input
                id="expense-category-custom"
                type="text"
                value={categoryCustom}
                onChange={(e) => setCategoryCustom(e.target.value)}
                maxLength={100}
                disabled={isSaving}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
              />
            </div>
          )}

          <div>
            <label htmlFor="expense-amount" className="block text-sm font-medium text-foreground mb-1">
              Jumlah (Rp)
            </label>
            <input
              id="expense-amount"
              type="text"
              inputMode="numeric"
              value={amount ? parseInt(amount, 10).toLocaleString('id-ID') : ''}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              disabled={isSaving}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>

          <div>
            <label htmlFor="expense-note" className="block text-sm font-medium text-foreground mb-1">
              Catatan
            </label>
            <input
              id="expense-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={255}
              disabled={isSaving}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
