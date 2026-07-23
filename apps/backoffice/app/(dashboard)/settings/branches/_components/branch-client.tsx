'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useEffect, useRef, useCallback } from 'react'
import BranchForm from './branch-form'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { BranchListItem } from './types'

interface Props {
  branches: BranchListItem[]
}

function formatLastSeen(value: Date | string | null): string {
  if (!value) return 'Belum pernah'
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return 'Belum pernah'
  return formatWIB(d, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function BranchClient({ branches: initialBranches }: Props) {
  const [branches, setBranches] = useState<BranchListItem[]>(initialBranches)
  const [showForm, setShowForm] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchListItem | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const isFormSubmittingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

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
    const originalOverflow = document.body.style.overflow
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeForm()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    // Move focus into dialog on open
    const firstInput = dialogRef.current?.querySelector<HTMLElement>('input, button')
    firstInput?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [showForm])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const refreshBranches = useCallback(async (): Promise<boolean> => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch('/api/bo/settings/branches', {
        credentials: 'same-origin',
        signal: controller.signal,
      })
      if (!res.ok) {
        setSuccessMsg(null)
        setErrorMsg('Gagal memperbarui daftar cabang')
        return false
      }
      const data = await res.json()
      if (!Array.isArray(data)) {
        setSuccessMsg(null)
        setErrorMsg('Format respons tidak valid')
        return false
      }
      setBranches(data)
      setErrorMsg(null)
      return true
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false
      }
      setSuccessMsg(null)
      setErrorMsg('Gagal memperbarui daftar cabang')
      return false
    }
  }, [])

  function openAddForm() {
    setEditingBranch(null)
    setErrorMsg(null)
    setShowForm(true)
  }

  function openEditForm(branch: BranchListItem) {
    setEditingBranch(branch)
    setErrorMsg(null)
    setShowForm(true)
  }

  function closeForm() {
    if (isFormSubmittingRef.current) return
    setShowForm(false)
    setEditingBranch(null)
  }

  async function handleSuccess() {
    const msg = editingBranch ? 'Cabang berhasil diperbarui' : 'Cabang berhasil ditambahkan'
    setErrorMsg(null)
    closeForm()
    const ok = await refreshBranches()
    if (ok) setSuccessMsg(msg)
  }

  async function handleToggleActive(branch: BranchListItem) {
    const nextActive = !branch.isActive
    const confirmMsg = nextActive
      ? `Aktifkan kembali cabang "${branch.name}"?`
      : `Nonaktifkan cabang "${branch.name}"? Cabang tidak dapat dipilih untuk pengguna baru.`
    if (!window.confirm(confirmMsg)) return
    setTogglingId(branch.id)
    try {
      const res = await fetch(`/api/bo/settings/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal mengubah status cabang (${res.status})`)
        return
      }
      const ok = await refreshBranches()
      if (ok) setSuccessMsg(nextActive ? 'Cabang berhasil diaktifkan' : 'Cabang berhasil dinonaktifkan')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setTogglingId(null)
    }
  }

  const columns: ColumnDef<BranchListItem>[] = [
    {
      accessorKey: 'code',
      header: 'Kode',
      cell: ({ row }) => <span className="font-mono text-xs text-foreground">{row.original.code}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'address',
      header: 'Alamat',
      cell: ({ row }) => <span className="text-foreground">{row.original.address ?? '-'}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Telepon',
      cell: ({ row }) => <span className="text-foreground">{row.original.phone ?? '-'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            row.original.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.original.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      id: 'lastSeenAt',
      header: 'Terakhir Online',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatLastSeen(row.original.lastSeenAt)}
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
            className="mr-3 text-xs font-medium text-primary hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => handleToggleActive(row.original)}
            disabled={togglingId === row.original.id}
            className={`text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${
              row.original.isActive ? 'text-destructive' : 'text-green-700'
            }`}
          >
            {togglingId === row.original.id
              ? 'Memproses...'
              : row.original.isActive
                ? 'Nonaktifkan'
                : 'Aktifkan'}
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
          + Tambah Cabang
        </button>
      </div>

      <DataTable
        data={branches}
        columns={columns}
        emptyMessage="Belum ada data cabang"
      />

      {showForm && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="branch-dialog-title"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="branch-dialog-title" className="text-base font-semibold text-foreground">
                {editingBranch ? 'Edit Cabang' : 'Tambah Cabang Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <BranchForm
                branch={editingBranch}
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
