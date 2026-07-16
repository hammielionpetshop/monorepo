'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useEffect, useRef, useCallback } from 'react'
import { DataTable } from '@/components/ui/data-table'
import UserForm from './user-form'
import type { UserListItem, RoleOption, BranchOption } from './types'

interface Props {
  users: UserListItem[]
  roles: RoleOption[]
  branches: BranchOption[]
}

export default function UserClient({ users: initialUsers, roles, branches }: Props) {
  const [users, setUsers] = useState<UserListItem[]>(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)
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

  const refreshUsers = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/bo/settings/users')
      if (!res.ok) {
        setSuccessMsg(null)
        setErrorMsg('Gagal memperbarui daftar pengguna')
        return false
      }
      const data = await res.json()
      setUsers(data)
      setErrorMsg(null)
      return true
    } catch {
      setSuccessMsg(null)
      setErrorMsg('Gagal memperbarui daftar pengguna')
      return false
    }
  }, [])

  function openAddForm() {
    setEditingUser(null)
    setShowForm(true)
  }

  function openEditForm(user: UserListItem) {
    setEditingUser(user)
    setShowForm(true)
  }

  function closeForm() {
    if (isFormSubmittingRef.current) return
    setShowForm(false)
    setEditingUser(null)
  }

  async function handleSuccess() {
    const msg = editingUser ? 'Pengguna berhasil diperbarui' : 'Pengguna berhasil ditambahkan'
    setErrorMsg(null)
    closeForm()
    const ok = await refreshUsers()
    if (ok) setSuccessMsg(msg)
  }

  async function handleDeactivate(user: UserListItem) {
    if (!window.confirm(`Nonaktifkan pengguna "${user.name}"? Pengguna tersebut tidak akan bisa login.`)) return
    setDeactivatingId(user.id)
    try {
      const res = await fetch(`/api/bo/settings/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menonaktifkan pengguna (${res.status})`)
        return
      }
      const ok = await refreshUsers()
      if (ok) setSuccessMsg('Pengguna berhasil dinonaktifkan')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setDeactivatingId(null)
    }
  }

  const columns: ColumnDef<UserListItem>[] = [
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => <span className="text-foreground">{row.original.username ?? '-'}</span>,
    },
    {
      accessorKey: 'staffNumber',
      header: 'Nomor Staf',
      cell: ({ row }) => <span className="text-foreground">{row.original.staffNumber ?? '-'}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="text-foreground">{row.original.email ?? '-'}</span>,
    },
    {
      accessorKey: 'roleName',
      header: 'Role',
      cell: ({ row }) => <span className="text-foreground">{row.original.roleName}</span>,
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => <span className="text-foreground">{row.original.branchName}</span>,
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
          {row.original.isActive && (
            <button
              onClick={() => handleDeactivate(row.original)}
              disabled={deactivatingId === row.original.id}
              className="text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deactivatingId === row.original.id ? 'Memproses...' : 'Nonaktifkan'}
            </button>
          )}
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
          + Tambah Pengguna
        </button>
      </div>

      <DataTable
        data={users}
        columns={columns}
        emptyMessage="Belum ada data pengguna"
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-dialog-title"
          onClick={closeForm}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border">
              <h2 id="user-dialog-title" className="text-base font-semibold text-foreground">
                {editingUser ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
              </h2>
            </div>
            <div className="px-6 py-4">
              <UserForm
                user={editingUser}
                roles={roles}
                branches={branches}
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
