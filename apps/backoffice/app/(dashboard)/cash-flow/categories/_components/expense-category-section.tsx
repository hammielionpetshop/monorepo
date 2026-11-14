'use client'

import { useState } from 'react'
import { NewBadge } from '@/components/ui/new-badge'
import type { CashFlowCategory, ExpenseLink } from './types'

interface Props {
  links: ExpenseLink[]
  setLinks: (update: (links: ExpenseLink[]) => ExpenseLink[]) => void
  expenseOptions: CashFlowCategory[]
  onSuccess: (text: string) => void
  onError: (text: string) => void
}

async function send(url: string, method: string, body: unknown): Promise<{ ok: true; data: ExpenseLink } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, data } : { ok: false, error: data.error ?? 'Gagal menyimpan' }
  } catch {
    return { ok: false, error: 'Terjadi kesalahan jaringan, silakan coba lagi' }
  }
}

/**
 * Kategori Pengeluaran Kasir (permintaan owner 2026-11-14): tambah, ganti nama, nonaktifkan, dan sambungkan ke satu
 * kategori Arus Kas. Tidak ada hapus; kategori nonaktif tidak bisa dipilih kasir, catatan lamanya tetap.
 */
export default function ExpenseCategorySection({ links, setLinks, expenseOptions, onSuccess, onError }: Props) {
  const [newName, setNewName] = useState('')
  const [newLink, setNewLink] = useState('')
  const [adding, setAdding] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null)

  const active = links.filter((l) => l.isActive)
  const inactive = links.filter((l) => !l.isActive)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (adding) return
    if (newName.trim().length < 2) return onError('Nama kategori kasir minimal 2 huruf')
    setAdding(true)
    const result = await send('/api/bo/expense-categories', 'POST', { name: newName.trim(), cashFlowCategoryId: newLink ? Number(newLink) : null })
    setAdding(false)
    if (!result.ok) return onError(result.error)
    setLinks((ls) => [...ls, result.data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName('')
    setNewLink('')
    onSuccess(`Kategori kasir "${result.data.name}" ditambahkan`)
  }

  async function saveLink(link: ExpenseLink, value: string) {
    const cashFlowCategoryId = value ? Number(value) : null
    setSavingId(link.id)
    const result = await send('/api/bo/cash-flow/expense-links', 'PUT', { expenseCategoryId: link.id, cashFlowCategoryId })
    setSavingId(null)
    if (!result.ok) return onError(result.error)
    setLinks((ls) => ls.map((l) => (l.id === link.id ? { ...l, cashFlowCategoryId } : l)))
    onSuccess('Sambungan kategori disimpan')
  }

  async function patch(link: ExpenseLink, body: { name?: string; isActive?: boolean }, message: string) {
    setSavingId(link.id)
    const result = await send(`/api/bo/expense-categories/${link.id}`, 'PATCH', body)
    setSavingId(null)
    if (!result.ok) return onError(result.error)
    setLinks((ls) => ls.map((l) => (l.id === link.id ? result.data : l)).sort((a, b) => a.name.localeCompare(b.name)))
    setRenaming(null)
    onSuccess(message)
  }

  function row(l: ExpenseLink) {
    const busy = savingId === l.id
    const isRenaming = renaming?.id === l.id
    return (
      <div key={l.id} className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm ${l.isActive ? '' : 'bg-muted/40'}`}>
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <form
              onSubmit={(e) => { e.preventDefault(); patch(l, { name: renaming.name.trim() }, 'Nama kategori kasir diubah') }}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                value={renaming.name}
                onChange={(e) => setRenaming({ id: l.id, name: e.target.value })}
                maxLength={50}
                autoFocus
                className="px-2 py-1 border border-border rounded-md bg-background"
              />
              <button type="submit" disabled={busy} className="text-xs font-medium text-primary hover:underline">Simpan</button>
              <button type="button" onClick={() => setRenaming(null)} className="text-xs text-muted-foreground hover:underline">Batal</button>
            </form>
          ) : (
            <span className={l.isActive ? 'text-foreground' : 'text-muted-foreground'}>
              {l.name}
              {!l.isActive && <span className="ml-2 text-xs">nonaktif — tidak bisa dipilih kasir</span>}
              {l.isActive && l.cashFlowCategoryId === null && <span className="ml-2 text-xs text-amber-700">belum disambungkan</span>}
            </span>
          )}
          {!isRenaming && (
            <div className="mt-0.5 flex gap-3">
              {l.isActive && (
                <button type="button" onClick={() => setRenaming({ id: l.id, name: l.name })} className="text-xs text-primary hover:underline">Ganti nama</button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => patch(l, { isActive: !l.isActive }, l.isActive ? `"${l.name}" dinonaktifkan` : `"${l.name}" diaktifkan lagi`)}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {l.isActive ? 'Nonaktifkan' : 'Aktifkan lagi'}
              </button>
            </div>
          )}
        </div>
        <select
          value={l.cashFlowCategoryId ?? ''}
          disabled={busy}
          onChange={(e) => saveLink(l, e.target.value)}
          className="px-2 py-1.5 border border-border rounded-md bg-background min-w-[220px]"
        >
          <option value="">— Belum disambungkan —</option>
          {expenseOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
        Kategori Pengeluaran Kasir <NewBadge feature="fitur/kelola-kategori-kasir" />
      </h2>
      <p className="text-sm text-muted-foreground mt-1 mb-3">
        Daftar yang dipilih kasir saat Catat Pengeluaran dari laci. Sambungkan tiap kategori ke satu kategori Arus Kas supaya terbaca
        di Laba Rugi. Satu kategori kasir sebaiknya berisi satu jenis biaya. Bila isinya perlu dipecah (mis. Listrik &amp; Air), tambah
        kategori baru lalu nonaktifkan yang lama — jangan diganti nama, karena nama baru ikut tampil di catatan lama.
      </p>

      <form onSubmit={add} className="mb-3 flex max-w-2xl flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={50}
          placeholder="Nama kategori kasir baru"
          className="flex-1 min-w-[200px] px-2 py-1.5 border border-border rounded-md bg-background text-sm"
        />
        <select value={newLink} onChange={(e) => setNewLink(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background text-sm min-w-[200px]">
          <option value="">— Sambungkan ke (opsional) —</option>
          {expenseOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" disabled={adding} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
          {adding ? 'Menambah...' : '+ Tambah'}
        </button>
      </form>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada kategori Pengeluaran Kasir.</p>
      ) : (
        <div className="max-w-2xl border border-border rounded-md divide-y divide-border">
          {active.map(row)}
          {inactive.map(row)}
        </div>
      )}
    </div>
  )
}
