'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useEffect, useRef } from 'react'
import { DataTable } from '@/components/ui/data-table'
import CategoryForm from './category-form'
import { TYPE_LABELS, type CashFlowCategory, type CashFlowType } from './types'

interface Props {
  categories: CashFlowCategory[]
}

export default function CategoryClient({ categories: initialCategories }: Props) {
  const [categories, setCategories] = useState<CashFlowCategory[]>(initialCategories)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CashFlowCategory | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
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
      const data = await res.json()
      setCategories(data)
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

  const columns: ColumnDef<CashFlowCategory>[] = [
    {
      accessorKey: 'name',
      header: 'Nama Kategori',
      cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="space-x-3 text-right">
          <button
            onClick={() => openEditForm(row.original)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            disabled={deletingId === row.original.id}
            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50"
          >
            {deletingId === row.original.id ? 'Menghapus...' : 'Hapus'}
          </button>
        </div>
      ),
    },
  ]

  function renderTable(type: CashFlowType) {
    const items = categories.filter((c) => c.type === type)
    return (
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">{TYPE_LABELS[type]}</h2>
        <DataTable
          data={items}
          columns={columns}
          emptyMessage={`Belum ada kategori ${TYPE_LABELS[type].toLowerCase()}`}
        />
      </div>
    )
  }

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

      <div className="mb-4">
        <button
          onClick={openAddForm}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          + Tambah Kategori
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {renderTable('INCOME')}
        {renderTable('EXPENSE')}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-dialog-title"
          onClick={closeForm}
        >
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border">
              <h2 id="category-dialog-title" className="text-base font-semibold text-foreground">
                {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
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
