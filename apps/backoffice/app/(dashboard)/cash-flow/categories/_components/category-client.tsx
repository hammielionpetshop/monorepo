'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useEffect, useRef } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { NewBadge } from '@/components/ui/new-badge'
import CategoryForm from './category-form'
import { TYPE_LABELS, REPORT_KIND_LABELS, type CashFlowCategory, type CashFlowType, type ExpenseLink } from './types'

interface Props {
  categories: CashFlowCategory[]
  expenseLinks: ExpenseLink[]
}

export default function CategoryClient({ categories: initialCategories, expenseLinks: initialLinks }: Props) {
  const [categories, setCategories] = useState<CashFlowCategory[]>(initialCategories)
  const [links, setLinks] = useState<ExpenseLink[]>(initialLinks)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CashFlowCategory | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [savingLinkId, setSavingLinkId] = useState<number | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const isFormSubmittingRef = useRef(false)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(null), 5000)
    return () => clearTimeout(t)
  }, [errorMsg])

  useEffect(() => {
    if (!showForm) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeForm()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [showForm])

  async function refreshCategories() {
    try {
      const res = await fetch('/api/bo/cash-flow/categories')
      if (!res.ok) {
        setErrorMsg('Gagal memperbarui daftar kategori')
        return
      }
      setCategories(await res.json())
      setErrorMsg(null)
    } catch {
      setErrorMsg('Gagal memperbarui daftar kategori')
    }
  }

  function openAddForm() {
    setEditingCategory(null)
    setShowForm(true)
  }

  function openEditForm(category: CashFlowCategory) {
    setEditingCategory(category)
    setShowForm(true)
  }

  function closeForm() {
    if (isFormSubmittingRef.current) return
    setShowForm(false)
    setEditingCategory(null)
  }

  async function handleSuccess() {
    setErrorMsg(null)
    setSuccessMsg(editingCategory ? 'Kategori berhasil diperbarui' : 'Kategori berhasil ditambahkan')
    closeForm()
    await refreshCategories()
  }

  async function toggleActive(category: CashFlowCategory) {
    try {
      const res = await fetch(`/api/bo/cash-flow/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: category.name,
          type: category.type,
          reportKind: category.reportKind,
          isActive: !category.isActive,
          ownerOnly: category.ownerOnly,
          noteRequired: category.noteRequired,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setErrorMsg(data.error ?? 'Gagal mengubah status kategori')
      setSuccessMsg(category.isActive ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan lagi')
      await refreshCategories()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    }
  }

  async function handleDelete(category: CashFlowCategory) {
    if (deletingId !== null) return
    if (!confirm(`Hapus kategori "${category.name}"?`)) return
    setDeletingId(category.id)
    try {
      const res = await fetch(`/api/bo/cash-flow/categories/${category.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menghapus kategori (${res.status})`)
        return
      }
      setSuccessMsg('Kategori berhasil dihapus')
      await refreshCategories()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setDeletingId(null)
    }
  }

  async function saveLink(link: ExpenseLink, value: string) {
    const cashFlowCategoryId = value ? Number(value) : null
    setSavingLinkId(link.id)
    try {
      const res = await fetch('/api/bo/cash-flow/expense-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseCategoryId: link.id, cashFlowCategoryId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setErrorMsg(data.error ?? 'Gagal menyimpan sambungan')
      setLinks((ls) => ls.map((l) => (l.id === link.id ? { ...l, cashFlowCategoryId } : l)))
      setSuccessMsg('Sambungan kategori disimpan')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSavingLinkId(null)
    }
  }

  const columns: ColumnDef<CashFlowCategory>[] = [
    {
      accessorKey: 'name',
      header: 'Nama Kategori',
      cell: ({ row }) => (
        <div>
          <span className={row.original.isActive ? 'text-foreground' : 'text-muted-foreground line-through'}>{row.original.name}</span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {row.original.isSystem && <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">sistem</span>}
            {!row.original.isActive && <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">nonaktif</span>}
            {row.original.ownerOnly && <span className="text-[10px] px-1.5 rounded bg-amber-100 text-amber-800">hanya Owner</span>}
            {row.original.noteRequired && <span className="text-[10px] px-1.5 rounded bg-sky-100 text-sky-800">catatan wajib</span>}
          </div>
        </div>
      ),
    },
    {
      id: 'reportKind',
      header: () => <span className="inline-flex items-center gap-1.5">Jenis <NewBadge feature="fitur/arus-kas-rapi" /></span>,
      cell: ({ row }) =>
        row.original.reportKind ? (
          <span className="text-muted-foreground">{REPORT_KIND_LABELS[row.original.reportKind]}</span>
        ) : (
          <span className="text-amber-700 font-medium">Belum dipilih</span>
        ),
    },
    {
      id: 'used',
      header: () => <div className="text-right">Dipakai</div>,
      cell: ({ row }) => <div className="text-right text-muted-foreground">{row.original.usedCount}</div>,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="space-x-3 text-right whitespace-nowrap">
          <button onClick={() => openEditForm(row.original)} className="text-xs font-medium text-primary hover:underline">
            Ubah
          </button>
          {!row.original.isSystem && (
            <button onClick={() => toggleActive(row.original)} className="text-xs font-medium text-muted-foreground hover:underline">
              {row.original.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          )}
          {!row.original.isSystem && row.original.usedCount === 0 && (
            <button
              onClick={() => handleDelete(row.original)}
              disabled={deletingId === row.original.id}
              className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
            >
              {deletingId === row.original.id ? 'Menghapus...' : 'Hapus'}
            </button>
          )}
        </div>
      ),
    },
  ]

  function renderTable(type: CashFlowType) {
    const items = categories.filter((c) => c.type === type && (showInactive || c.isActive))
    return (
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">{TYPE_LABELS[type]}</h2>
        <DataTable data={items} columns={columns} emptyMessage={`Belum ada kategori ${TYPE_LABELS[type].toLowerCase()}`} />
      </div>
    )
  }

  const unpickedCount = categories.filter((c) => c.reportKind === null).length
  const expenseOptions = categories.filter((c) => c.type === 'EXPENSE' && !c.isSystem && c.isActive)

  return (
    <>
      {successMsg && (
        <div role="status" aria-live="polite" className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {errorMsg && !successMsg && (
        <div role="alert" aria-live="assertive" className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      {unpickedCount > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unpickedCount} kategori lama belum dipilih jenisnya (Biaya / Bukan biaya / Pendapatan lain / Bukan pendapatan). Tekan Ubah pada kategori itu
          untuk memilih — supaya Finance tahu apakah kategori itu mengurangi laba.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <button onClick={openAddForm} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          + Tambah Kategori
        </button>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Tampilkan yang nonaktif
        </label>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {renderTable('INCOME')}
        {renderTable('EXPENSE')}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
          Sambungan kategori Pengeluaran Kasir <NewBadge feature="fitur/arus-kas-rapi" />
        </h2>
        <p className="text-sm text-muted-foreground mt-1 mb-3">
          Pengeluaran dari laci kasir punya daftar kategori sendiri. Sambungkan tiap kategori ke satu kategori Arus Kas supaya satu biaya
          hanya punya satu nama di laporan Finance. Tampilan kasir tidak berubah.
        </p>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada kategori Pengeluaran Kasir.</p>
        ) : (
          <div className="max-w-2xl border border-border rounded-md divide-y divide-border">
            {links.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-foreground">
                  {l.name}
                  {l.cashFlowCategoryId === null && <span className="ml-2 text-xs text-amber-700">belum disambungkan</span>}
                </span>
                <select
                  value={l.cashFlowCategoryId ?? ''}
                  disabled={savingLinkId === l.id}
                  onChange={(e) => saveLink(l, e.target.value)}
                  className="px-2 py-1.5 border border-border rounded-md bg-background min-w-[220px]"
                >
                  <option value="">— Belum disambungkan —</option>
                  {expenseOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-dialog-title"
        >
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border">
              <h2 id="category-dialog-title" className="text-base font-semibold text-foreground">
                {editingCategory ? 'Ubah Kategori' : 'Tambah Kategori Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <CategoryForm
                category={editingCategory}
                onSuccess={handleSuccess}
                onCancel={closeForm}
                onSubmittingChange={(v) => { isFormSubmittingRef.current = v }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
