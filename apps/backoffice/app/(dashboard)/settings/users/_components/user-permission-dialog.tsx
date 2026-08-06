'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PermissionOption, UserListItem } from './types'

interface Props {
  user: UserListItem
  permissions: PermissionOption[]
  onClose: () => void
  onSaved: (message: string) => void
}

/**
 * Izin yang ditunjuk ke satu orang, di luar izin bawaan role-nya.
 * Grant hanya menambah — role tetap jadi dasar, izin di sini tidak pernah mencabut.
 */
export default function UserPermissionDialog({ user, permissions, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/bo/settings/users/${user.id}/permissions`)
      if (!res.ok) throw new Error('gagal')
      const data = await res.json()
      setSelected(new Set((data.permissions ?? []).map((p: { permissionId: number }) => p.permissionId)))
      setError(null)
    } catch {
      setError('Gagal memuat izin khusus pengguna')
    } finally {
      setIsLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isSaving])

  const toggle = (permissionId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(permissionId)) next.delete(permissionId)
      else next.add(permissionId)
      return next
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/settings/users/${user.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan izin khusus')
        return
      }
      onSaved(`Izin khusus untuk "${user.name}" berhasil disimpan`)
    } catch {
      setError('Gagal menyimpan izin khusus')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-background border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Izin khusus ${user.name}`}
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Izin Khusus</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user.name} · {user.roleName}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs text-muted-foreground mb-3">
            Izin di sini berlaku khusus untuk orang ini, menambah izin bawaan jabatannya.
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada izin yang terdaftar.</p>
          ) : (
            <ul className="space-y-2">
              {permissions.map((permission) => (
                <li key={permission.id}>
                  <label className="flex items-start gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-accent transition-colors">
                    <input
                      type="checkbox"
                      checked={selected.has(permission.id)}
                      onChange={() => toggle(permission.id)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {permission.name}
                      </span>
                      <span className="block text-xs text-muted-foreground font-mono">
                        {permission.code}
                      </span>
                      {permission.description && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {permission.description}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="mt-3 bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
