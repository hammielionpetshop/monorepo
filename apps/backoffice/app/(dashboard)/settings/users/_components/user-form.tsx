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

const EMPTY_FORM: UserFormData = {
  name: '',
  username: '',
  email: '',
  staffNumber: '',
  password: '',
  pin: '',
  roleId: '',
  branchId: '',
}

export default function UserForm({ user, roles, branches, onSuccess, onCancel, onSubmittingChange }: Props) {
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        username: user.username ?? '',
        email: user.email ?? '',
        staffNumber: user.staffNumber ?? '',
        password: '',
        pin: '',
        roleId: user.roleId,
        branchId: user.branchId,
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [user])

  // Saat tambah user: pre-fill password & PIN dengan default (agar OWNER lihat & bisa ubah).
  // Bila fetch gagal (mis. non-OWNER), biarkan kosong — server akan mengisi default sendiri.
  useEffect(() => {
    if (user) return
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/bo/settings/security')
        if (!res.ok) return
        const data = await res.json()
        if (!active) return
        setForm((f) => ({ ...f, password: data.defaultPassword ?? '', pin: data.defaultPin ?? '' }))
      } catch {
        // abaikan — default diisi server
      }
    })()
    return () => { active = false }
  }, [user])

  function setSubmitting(v: boolean) {
    setIsSubmitting(v)
    onSubmittingChange?.(v)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    setErrorMsg(null)

    if (!form.name.trim()) {
      setErrorMsg('Nama wajib diisi')
      return
    }
    if (!form.username.trim()) {
      setErrorMsg('Username wajib diisi')
      return
    }
    if (!user && form.password && form.password.length < 6) {
      setErrorMsg('Password minimal 6 karakter')
      return
    }
    if (!user && form.pin && !/^\d{4,6}$/.test(form.pin)) {
      setErrorMsg('PIN harus 4–6 digit angka')
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

    setSubmitting(true)
    try {
      const url = user ? `/api/bo/settings/users/${user.id}` : '/api/bo/settings/users'
      const method = user ? 'PATCH' : 'POST'

      const body: Record<string, unknown> = {}
      if (user) {
        body.name = form.name.trim()
        body.username = form.username.trim()
        body.email = form.email.trim() || null
        body.staffNumber = form.staffNumber.trim() || null
        if (typeof form.roleId === 'number') body.roleId = form.roleId
        if (typeof form.branchId === 'number') body.branchId = form.branchId
      } else {
        body.name = form.name.trim()
        body.username = form.username.trim()
        body.email = form.email.trim() || null
        body.staffNumber = form.staffNumber.trim() || null
        body.password = form.password
        body.pin = form.pin
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

      setSubmitting(false)
      onSuccess()
      return
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset() {
    if (!user) return
    if (!window.confirm(`Reset kredensial "${user.name}" ke default? Pengguna wajib mengganti password & PIN saat login berikutnya.`)) return
    setErrorMsg(null)
    setIsResetting(true)
    onSubmittingChange?.(true)
    try {
      const res = await fetch(`/api/bo/settings/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetCredentials: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal mereset kredensial (${res.status})`)
        return
      }
      onSuccess()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsResetting(false)
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
        <label htmlFor="user-username" className="block text-sm font-medium text-foreground mb-1">
          Username <span className="text-destructive">*</span>
        </label>
        <input
          id="user-username"
          type="text"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          maxLength={50}
          placeholder="Untuk login backoffice"
          autoComplete="off"
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
        <>
          <div>
            <label htmlFor="user-password" className="block text-sm font-medium text-foreground mb-1">
              Password Awal
            </label>
            <input
              id="user-password"
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Kosongkan untuk pakai default"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="user-pin" className="block text-sm font-medium text-foreground mb-1">
              PIN Awal
            </label>
            <input
              id="user-pin"
              type="text"
              inputMode="numeric"
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
              maxLength={6}
              placeholder="Kosongkan untuk pakai default"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Staf wajib mengganti password &amp; PIN saat login pertama.
            </p>
          </div>
        </>
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

      {user && (
        <div className="pt-1">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting || isResetting}
            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResetting ? 'Mereset...' : 'Reset kredensial ke default'}
          </button>
        </div>
      )}

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
          disabled={isSubmitting || isResetting}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isResetting}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : user ? 'Simpan Perubahan' : 'Tambah Pengguna'}
        </button>
      </div>
    </form>
  )
}
