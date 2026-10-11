'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import SupplierForm from './supplier-form'
import type { Supplier } from './types'

interface Props {
  suppliers: Supplier[]
}

export default function SupplierClient({ suppliers: initialSuppliers }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [togglingSupplier, setTogglingSupplier] = useState<Supplier | null>(null)
  const [isToggling, setIsToggling] = useState(false)
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
    if (!showForm && !deletingSupplier) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (deletingSupplier) { setDeletingSupplier(null); return }
        closeForm()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [showForm, deletingSupplier])

  async function refreshSuppliers() {
    try {
      const res = await fetch('/api/bo/master-data/suppliers')
      if (!res.ok) {
        setErrorMsg('Gagal memperbarui daftar supplier')
        return
      }
      const data = await res.json()
      setSuppliers(data)
      setErrorMsg(null)
    } catch {
      setErrorMsg('Gagal memperbarui daftar supplier')
    }
  }

  function openAddForm() {
    setEditingSupplier(null)
    setShowForm(true)
  }

  function openEditForm(supplier: Supplier) {
    setEditingSupplier(supplier)
    setShowForm(true)
  }

  function closeForm() {
    if (isFormSubmittingRef.current) return
    setShowForm(false)
    setEditingSupplier(null)
  }

  async function handleSuccess() {
    setErrorMsg(null)
    setSuccessMsg(editingSupplier ? 'Supplier berhasil diperbarui' : 'Supplier berhasil ditambahkan')
    closeForm()
    await refreshSuppliers()
  }

  async function handleDelete() {
    if (!deletingSupplier || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/bo/master-data/suppliers/${deletingSupplier.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menghapus supplier (${res.status})`)
        setDeletingSupplier(null)
        return
      }
      setSuccessMsg('Supplier berhasil dihapus')
      setDeletingSupplier(null)
      await refreshSuppliers()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
      setDeletingSupplier(null)
    } finally {
      setIsDeleting(false)
    }
  }

  // Nonaktifkan, bukan hapus: supplier yang punya riwayat tetap utuh, hanya hilang dari pilihan
  // dokumen baru (PO baru, Retur Supplier Luar).
  async function handleToggleActive() {
    if (!togglingSupplier || isToggling) return
    const nextActive = !togglingSupplier.isActive
    setIsToggling(true)
    try {
      const res = await fetch(`/api/bo/master-data/suppliers/${togglingSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? `Gagal mengubah status supplier (${res.status})`)
        return
      }
      setSuccessMsg(`Supplier ${togglingSupplier.name} ${nextActive ? 'diaktifkan kembali' : 'dinonaktifkan'}`)
      await refreshSuppliers()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsToggling(false)
      setTogglingSupplier(null)
    }
  }

  const filtered = suppliers.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone ?? '').toLowerCase().includes(q) ||
      (s.contactPerson ?? '').toLowerCase().includes(q)
    )
  })

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'contactPerson',
      header: 'Kontak',
      cell: ({ row }) => <span className="text-foreground">{row.original.contactPerson ?? '-'}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Telepon',
      cell: ({ row }) => <span className="text-foreground">{row.original.phone ?? '-'}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="text-foreground">{row.original.email ?? '-'}</span>,
    },
    {
      accessorKey: 'paymentTermDays',
      header: 'Termin',
      cell: ({ row }) => (
        <span className="text-foreground">
          {row.original.paymentTermDays != null ? `${row.original.paymentTermDays} hari` : '-'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.isActive ? (
          <span className="inline-block rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">Aktif</span>
        ) : (
          <span className="inline-block rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Nonaktif</span>
        ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <button
            onClick={() => openEditForm(row.original)}
            className="mr-3 text-xs font-medium text-primary hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => setTogglingSupplier(row.original)}
            className="mr-3 text-xs font-medium text-amber-700 hover:underline"
          >
            {row.original.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button
            onClick={() => setDeletingSupplier(row.original)}
            className="text-xs font-medium text-destructive hover:underline"
          >
            Hapus
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      {togglingSupplier && (
        <RequiredChoiceDialog
          title={togglingSupplier.isActive ? `Nonaktifkan supplier ${togglingSupplier.name}?` : `Aktifkan kembali supplier ${togglingSupplier.name}?`}
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setTogglingSupplier(null), variant: 'secondary', disabled: isToggling },
            {
              label: isToggling ? 'Memproses...' : togglingSupplier.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan',
              onClick: () => { void handleToggleActive() },
              variant: 'primary',
              disabled: isToggling,
            },
          ]}
        >
          {togglingSupplier.isActive ? (
            <p>
              Supplier ini tidak akan muncul lagi di pilihan <b>PO baru</b> dan <b>Retur Supplier Luar</b>. PO, hutang,
              dan riwayat lama tetap utuh dan tetap menampilkan namanya. Bisa diaktifkan kembali kapan saja.
            </p>
          ) : (
            <p>Supplier ini akan muncul lagi di pilihan PO baru dan Retur Supplier Luar.</p>
          )}
        </RequiredChoiceDialog>
      )}
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

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage={
          search ? 'Tidak ada supplier yang cocok dengan pencarian' : 'Belum ada data supplier'
        }
        toolbar={
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, telepon, atau kontak..."
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={openAddForm}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              + Tambah Supplier
            </button>
          </div>
        }
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-dialog-title"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="supplier-dialog-title" className="text-base font-semibold text-foreground">
                {editingSupplier ? 'Edit Supplier' : 'Tambah Supplier Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <SupplierForm
                supplier={editingSupplier}
                onSuccess={handleSuccess}
                onCancel={closeForm}
                onSubmittingChange={(v) => { isFormSubmittingRef.current = v }}
              />
            </div>
          </div>
        </div>
      )}

      {deletingSupplier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={() => { if (!isDeleting) setDeletingSupplier(null) }}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="delete-dialog-title" className="text-base font-semibold text-foreground">
                Hapus Supplier
              </h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-foreground">
                Apakah Anda yakin ingin menghapus supplier{' '}
                <span className="font-medium">{deletingSupplier.name}</span>?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supplier yang memiliki riwayat purchase order tidak dapat dihapus.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => setDeletingSupplier(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
