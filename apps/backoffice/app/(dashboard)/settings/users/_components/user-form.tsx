'use client'

import { useState, useEffect } from 'react'
import type { UserListItem, RoleOption, BranchOption, UserFormData } from './types'

interface Props {
  user?: UserListItem | null
  roles: RoleOption[]
  branches: BranchOption[]
  onSuccess: () => void
  onCancel: () => void
  onSubmittingChange?: (v: boolean) => void
}

export default function UserForm({ user, roles, branches, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<UserFormData>({
    name: '',
    email: '',
    staffNumber: '',
    password: '',
    roleId: '',
    branchId: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        email: user.email ?? '',
        staffNumber: user.staffNumber ?? '',
        password: '',
        roleId: user.roleId,
        branchId: user.branchId,
      })
    } else {
      setForm({ name: '', email: '', staffNumber: '', password: '', roleId: '', branchId: '' })
    }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama wajib diisi')
      return
    }
    if (!user && !form.password) {
      setErrorMsg('Password awal wajib diisi')
      return
    }
    if (!user && form.password.length < 6) {
      setErrorMsg('Password minimal 6 karakter')
      return
    }
    if (form.roleId === '') {
      setErrorMsg('Role wajib dipilih')
      return
    }
    if (form.branchId === '') {
      setErrorMsg('Cabang wajib dipilih')
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)
    try {
      const url = user ? `/api/bo/settings/users/${user.id}` : '/api/bo/settings/users'
      const method = user ? 'PATCH' : 'POST'

      const body: Record<string, unknown> = {}
      if (user) {
        body.name = form.name.trim()
        body.email = form.email.trim() || null
        body.staffNumber = form.staffNumber.trim() || null
        if (typeof form.roleId === 'number') body.roleId = form.roleId
        if (typeof form.branchId === 'number') body.branchId = form.branchId
      } else {
        body.name = form.name.trim()
        body.email = form.email.trim() || null
        body.staffNumber = form.staffNumber.trim() || null
        body.password = form.password
        body.roleId = form.roleId
        body.branchId = form.branchId
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal ${user ? 'memperbarui' : 'menyimpan'} pengguna (${res.status})`)
        return
      }

      setIsSubmitting(false)
      onSubmittingChange?.(false)
      onSuccess()
      return
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="user-name" className="block text-sm font-medium text-foreground mb-1">
          Nama <span className="text-destructive">*</span>
        </label>
        <input
          id="user-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={100}
          placeholder="Nama lengkap"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="user-email" className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <input
          id="user-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          maxLength={255}
          placeholder="email@contoh.com (opsional)"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="user-staff-number" className="block text-sm font-medium text-foreground mb-1">
          Nomor Staf
        </label>
        <input
          id="user-staff-number"
          type="text"
          value={form.staffNumber}
          onChange={(e) => setForm((f) => ({ ...f, staffNumber: e.target.value }))}
          maxLength={50}
          placeholder="Nomor staf (opsional)"
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {!user && (
        <div>
          <label htmlFor="user-password" className="block text-sm font-medium text-foreground mb-1">
            Password Awal <span className="text-destructive">*</span>
          </label>
          <input
            id="user-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Minimal 6 karakter"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      )}

      <div>
        <label htmlFor="user-role" className="block text-sm font-medium text-foreground mb-1">
          Role <span className="text-destructive">*</span>
        </label>
        <select
          id="user-role"
          value={form.roleId}
          onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value ? Number(e.target.value) : '' }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Pilih role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="user-branch" className="block text-sm font-medium text-foreground mb-1">
          Cabang <span className="text-destructive">*</span>
        </label>
        <select
          id="user-branch"
          value={form.branchId}
          onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value ? Number(e.target.value) : '' }))}
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Pilih cabang</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : user ? 'Simpan Perubahan' : 'Tambah Pengguna'}
        </button>
      </div>
    </form>
  )
}