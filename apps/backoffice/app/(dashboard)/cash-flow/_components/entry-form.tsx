'use client'

import { useState, useMemo } from 'react'
import { TYPE_LABELS, type CashFlowCategoryOption, type CashFlowType } from './types'

interface Props {
  categories: CashFlowCategoryOption[]
  currentUserName: string
  onSuccess: () => void
  onError: (msg: string) => void
}

export default function EntryForm({ categories, currentUserName, onSuccess, onError }: Props) {
  const [type, setType] = useState<CashFlowType>('EXPENSE')
  const [categoryId, setCategoryId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  )

  function changeType(t: CashFlowType) {
    setType(t)
    setCategoryId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!categoryId) {
      setErrorMsg('Kategori wajib dipilih')
      return
    }
    const amountNum = Number(amount)
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setErrorMsg('Total harus lebih dari 0')
      return
    }
    if (!Number.isInteger(amountNum)) {
      setErrorMsg('Total harus berupa angka bulat')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bo/cash-flow/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          categoryId: Number(categoryId),
          amount: amountNum,
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menyimpan transaksi (${res.status})`)
        return
      }
      setCategoryId('')
      setAmount('')
      setNote('')
      onSuccess()
    } catch {
      onError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
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
              onClick={() => changeType(t)}
              className={[
                'px-3 py-2 text-sm font-medium rounded-md border transition-colors',
                type === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-accent',
              ].join(' ')}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Diinput oleh</label>
        <input
          type="text"
          value={currentUserName}
          readOnly
          disabled
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/40 text-muted-foreground"
        />
      </div>

      <div>
        <label htmlFor="entry-category" className="block text-sm font-medium text-foreground mb-1">
          Kategori <span className="text-destructive">*</span>
        </label>
        <select
          id="entry-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Pilih kategori —</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {filteredCategories.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Belum ada kategori {TYPE_LABELS[type].toLowerCase()}. Tambahkan dulu di menu Kategori.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="entry-amount" className="block text-sm font-medium text-foreground mb-1">
          Total (Rp) <span className="text-destructive">*</span>
        </label>
        <input
          id="entry-amount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="entry-note" className="block text-sm font-medium text-foreground mb-1">
          Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
        </label>
        <textarea
          id="entry-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={255}
          rows={2}
          placeholder="Keterangan tambahan"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      {errorMsg && (
        <div role="alert" aria-live="assertive" className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
      </button>
    </form>
  )
}
