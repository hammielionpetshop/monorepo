'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BranchOption, UserOption, CategoryOption } from '../page'

interface Props {
  branches: BranchOption[]
  users: UserOption[]
  categories: CategoryOption[]
}

export default function SOInitiatorClient({ branches, users, categories }: Props) {
  const router = useRouter()
  const [branchId, setBranchId] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function toggleCategory(id: number) {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  function toggleUser(id: number) {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) return

    if (!window.confirm('Mulai Stock Opname Besar? SO akan muncul di POS cabang yang dipilih.')) return

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/bo/stock-opnames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: Number(branchId),
          categoryScope: selectedCategories.length > 0 ? selectedCategories : null,
          assignedUserIds: selectedUsers.length > 0 ? selectedUsers : null,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal membuat SO (${res.status})`)
        return
      }

      router.push('/inventory/stock-opname?success=1')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Cabang <span className="text-destructive">*</span>
        </label>
        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          required
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">-- Pilih Cabang --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {categories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Kategori Produk <span className="text-muted-foreground text-xs">(kosongkan = semua kategori)</span>
          </label>
          <div className="border border-input rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
            {categories.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="rounded"
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {users.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Petugas Ditugaskan <span className="text-muted-foreground text-xs">(opsional)</span>
          </label>
          <div className="border border-input rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
            {users.map(u => (
              <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="rounded"
                />
                {u.name}{u.staffNumber ? ` (${u.staffNumber})` : ''}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Catatan <span className="text-muted-foreground text-xs">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Catatan tambahan untuk SO ini..."
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !branchId}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Membuat SO...' : 'Mulai SO Besar'}
        </button>
        <a
          href="/inventory/stock-opname"
          className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
        >
          Batal
        </a>
      </div>
    </form>
  )
}