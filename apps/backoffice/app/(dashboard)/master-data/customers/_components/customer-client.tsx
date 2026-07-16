'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import CustomerForm from './customer-form'
import type { Customer } from './types'

interface Props {
  customers: Customer[]
}

export default function CustomerClient({ customers: initialCustomers }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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
    if (!showForm && !deletingCustomer) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (deletingCustomer) { setDeletingCustomer(null); return }
        closeForm()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [showForm, deletingCustomer])

  async function refreshCustomers() {
    try {
      const res = await fetch('/api/bo/customers')
      if (!res.ok) {
        setErrorMsg('Gagal memperbarui daftar customer')
        return
      }
      const data = await res.json()
      setCustomers(data)
      setErrorMsg(null)
    } catch {
      setErrorMsg('Gagal memperbarui daftar customer')
    }
  }

  function openAddForm() {
    setEditingCustomer(null)
    setShowForm(true)
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer)
    setShowForm(true)
  }

  function closeForm() {
    if (isFormSubmittingRef.current) return
    setShowForm(false)
    setEditingCustomer(null)
  }

  async function handleSuccess() {
    setErrorMsg(null)
    setSuccessMsg(editingCustomer ? 'Customer berhasil diperbarui' : 'Customer berhasil ditambahkan')
    closeForm()
    await refreshCustomers()
  }

  async function handleDelete() {
    if (!deletingCustomer || isDeleting) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/bo/customers/${deletingCustomer.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menghapus customer (${res.status})`)
        setDeletingCustomer(null)
        return
      }
      setSuccessMsg('Customer berhasil dihapus')
      setDeletingCustomer(null)
      await refreshCustomers()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
      setDeletingCustomer(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q)
    )
  })

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'code',
      header: 'Kode',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.code ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
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
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            row.original.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.original.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Link
            href={`/master-data/customers/${row.original.id}`}
            className="mr-3 text-xs font-medium text-muted-foreground hover:underline"
          >
            Detail
          </Link>
          <button
            onClick={() => openEditForm(row.original)}
            className="mr-3 text-xs font-medium text-primary hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => setDeletingCustomer(row.original)}
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
          search ? 'Tidak ada customer yang cocok dengan pencarian' : 'Belum ada data customer'
        }
        toolbar={
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode, atau telepon..."
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={openAddForm}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              + Tambah Customer
            </button>
          </div>
        }
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-dialog-title"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="customer-dialog-title" className="text-base font-semibold text-foreground">
                {editingCustomer ? 'Edit Customer' : 'Tambah Customer Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <CustomerForm
                customer={editingCustomer}
                onSuccess={handleSuccess}
                onCancel={closeForm}
                onSubmittingChange={(v) => { isFormSubmittingRef.current = v }}
              />
            </div>
          </div>
        </div>
      )}

      {deletingCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={() => { if (!isDeleting) setDeletingCustomer(null) }}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="delete-dialog-title" className="text-base font-semibold text-foreground">
                Hapus Customer
              </h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-foreground">
                Apakah Anda yakin ingin menghapus customer{' '}
                <span className="font-medium">{deletingCustomer.name}</span>?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Customer yang memiliki riwayat transaksi tidak dapat dihapus.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => setDeletingCustomer(null)}
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
