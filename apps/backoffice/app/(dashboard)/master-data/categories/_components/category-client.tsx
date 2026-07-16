'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useEffect, useRef } from 'react'
import { DataTable } from '@/components/ui/data-table'
import CategoryForm from './category-form'
import type { Category } from './types'

interface Props {
  categories: Category[]
}

export default function CategoryClient({ categories: initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
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
      const res = await fetch('/api/bo/master-data/categories')
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

  function openEditForm(category: Category) {
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

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: 'name',
      header: 'Nama Kategori',
      cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <button
            onClick={() => openEditForm(row.original)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Edit
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm"
        >
          {successMsg}
        </div>
      )}

      {errorMsg && !successMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm"
        >
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

      <DataTable
        data={categories}
        columns={columns}
        emptyMessage="Belum ada data kategori"
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-dialog-title"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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
