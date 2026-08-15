'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import UserPermissionDialog from './user-permission-dialog'
import type { UserListItem, PermissionOption } from './types'

interface Props {
  users: UserListItem[]
  permissions: PermissionOption[]
  /** Pesan hasil dari halaman tambah/edit, dibaca dari query `?success=`. */
  flash?: string | null
}

export default function UserClient({ users: initialUsers, permissions, flash }: Props) {
  const [users, setUsers] = useState<UserListItem[]>(initialUsers)
  const [permissionUser, setPermissionUser] = useState<UserListItem | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(flash ?? null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)

  // Daftar bisa diperbarui server (setelah kembali dari halaman form) maupun klien
  // (setelah menonaktifkan) — tanpa sinkronisasi ini yang dari server terabaikan.
  useEffect(() => {
    setUsers(initialUsers)
  }, [initialUsers])

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
      cell: ({ row }) => {
        // Cabang utama + penanda kalau ia juga bertugas di tempat lain. Tanpa ini, dua staf
        // dengan cabang utama sama terlihat identik di daftar padahal cakupannya berbeda.
        const extra = row.original.assignedBranches.filter((b) => b.id !== row.original.branchId)
        return (
          <span className="text-foreground">
            {row.original.branchName}
            {extra.length > 0 && (
              <span
                className="ml-1.5 text-xs text-muted-foreground"
                title={extra.map((b) => b.name).join(', ')}
              >
                +{extra.length} cabang
              </span>
            )}
          </span>
        )
      },
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
          <Link
            href={`/settings/users/${row.original.id}`}
            className="mr-3 text-xs font-medium text-primary hover:underline"
          >
            Edit
          </Link>
          <button
            onClick={() => setPermissionUser(row.original)}
            className="mr-3 text-xs font-medium text-primary hover:underline"
          >
            Izin Khusus
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
        <Link
          href="/settings/users/new"
          className="inline-block px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          + Tambah Pengguna
        </Link>
      </div>

      <DataTable
        data={users}
        columns={columns}
        emptyMessage="Belum ada data pengguna"
      />

      {permissionUser && (
        <UserPermissionDialog
          user={permissionUser}
          permissions={permissions}
          onClose={() => setPermissionUser(null)}
          onSaved={(message) => {
            setPermissionUser(null)
            setErrorMsg(null)
            setSuccessMsg(message)
          }}
        />
      )}

    </>
  )
}
