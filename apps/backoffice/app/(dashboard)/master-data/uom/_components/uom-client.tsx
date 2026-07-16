'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useEffect, useRef } from 'react'
import { DataTable } from '@/components/ui/data-table'
import UomForm from './uom-form'
import type { Uom } from './types'

interface Props {
  uoms: Uom[]
}

export default function UomClient({ uoms: initialUoms }: Props) {
  const [uoms, setUoms] = useState<Uom[]>(initialUoms)
  const [showForm, setShowForm] = useState(false)
  const [editingUom, setEditingUom] = useState<Uom | null>(null)
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

  async function refreshUoms() {
    try {
      const res = await fetch('/api/bo/master-data/uom')
      if (!res.ok) {
        setErrorMsg('Gagal memperbarui daftar satuan ukur')
        return
      }
      const data = await res.json()
      setUoms(data)
      setErrorMsg(null)
    } catch {
      setErrorMsg('Gagal memperbarui daftar satuan ukur')
    }
  }

  function openAddForm() {
    setEditingUom(null)
    setShowForm(true)
  }

  function openEditForm(uom: Uom) {
    setEditingUom(uom)
    setShowForm(true)
  }

  function closeForm() {
    if (isFormSubmittingRef.current) return
    setShowForm(false)
    setEditingUom(null)
  }

  async function handleSuccess() {
    setErrorMsg(null)
    setSuccessMsg(editingUom ? 'Satuan ukur berhasil diperbarui' : 'Satuan ukur berhasil ditambahkan')
    closeForm()
    await refreshUoms()
  }

  const columns: ColumnDef<Uom>[] = [
    {
      accessorKey: 'code',
      header: 'Kode',
      cell: ({ row }) => <span className="font-mono text-foreground">{row.original.code}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
    },
    {
      id: 'type',
      header: 'Tipe',
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            row.original.isBase
              ? 'bg-green-100 text-green-800'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.original.isBase ? 'Dasar' : 'Turunan'}
        </span>
      ),
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
          + Tambah Satuan Ukur
        </button>
      </div>

      <DataTable
        data={uoms}
        columns={columns}
        emptyMessage="Belum ada data satuan ukur"
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="uom-dialog-title"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="uom-dialog-title" className="text-base font-semibold text-foreground">
                {editingUom ? 'Edit Satuan Ukur' : 'Tambah Satuan Ukur Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <UomForm
                uom={editingUom}
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
