'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { UserEditData, RoleOption, BranchOption, UserFormData } from './types'

interface Props {
  /** Kosong = mode tambah. */
  user?: UserEditData | null
  roles: RoleOption[]
  branches: BranchOption[]
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
  assignedBranchIds: [],
}

function initialForm(user?: UserEditData | null): UserFormData {
  if (!user) return EMPTY_FORM
  return {
    name: user.name,
    username: user.username ?? '',
    email: user.email ?? '',
    staffNumber: user.staffNumber ?? '',
    password: '',
    pin: '',
    roleId: user.roleId,
    branchId: user.branchId,
    // Cabang utama dikeluarkan: ia sudah diwakili pilihan "Cabang utama" di atas, dan
    // menampilkannya lagi sebagai centang yang tak boleh dilepas hanya membingungkan.
    assignedBranchIds: user.assignedBranches
      .map((b) => b.id)
      .filter((id) => id !== user.branchId),
  }
}

export default function UserForm({ user, roles, branches }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<UserFormData>(() => initialForm(user))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

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

  // Tetap true sesudah simpan berhasil sampai navigasi selesai — kalau dilepas di sini,
  // tombolnya hidup lagi selama transisi router dan pengguna bisa mengirim dua kali.
  const busy = isSubmitting || isResetting

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setErrorMsg(null)
    setResetMsg(null)

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

    setIsSubmitting(true)
    try {
      const url = user ? `/api/bo/settings/users/${user.id}` : '/api/bo/settings/users'
      const method = user ? 'PATCH' : 'POST'

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim() || null,
        staffNumber: form.staffNumber.trim() || null,
        assignedBranchIds: form.assignedBranchIds,
      }
      if (user) {
        if (typeof form.roleId === 'number') body.roleId = form.roleId
        if (typeof form.branchId === 'number') body.branchId = form.branchId
      } else {
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
        setIsSubmitting(false)
        return
      }

      // Sengaja tidak melepas isSubmitting: halaman ini segera ditinggalkan.
      router.push(`/settings/users?success=${user ? 'updated' : 'created'}`)
      router.refresh()
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
      setIsSubmitting(false)
    }
  }

  async function handleReset() {
    if (!user) return
    if (!window.confirm(`Reset kredensial "${user.name}" ke default? Pengguna wajib mengganti password & PIN saat login berikutnya.`)) return
    setErrorMsg(null)
    setResetMsg(null)
    setIsResetting(true)
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
      // Tetap di halaman ini: OWNER biasanya perlu langsung membacakan kredensial
      // default ke orangnya, jadi memindahkannya ke daftar justru mengganggu.
      setResetMsg('Kredensial dikembalikan ke default. Pengguna wajib menggantinya saat login berikutnya.')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsResetting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Dua kolom mulai md; di layar sempit tetap menumpuk satu kolom. Pasangannya
          sengaja: identitas (nama/username), kontak (email/nomor staf), kredensial awal,
          lalu penempatan (role/cabang). */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            className={inputClass}
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
            className={inputClass}
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
            className={inputClass}
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
            className={inputClass}
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
                className={inputClass}
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
                className={inputClass}
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
            className={inputClass}
          >
            <option value="">Pilih role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="user-branch" className="block text-sm font-medium text-foreground mb-1">
            Cabang utama <span className="text-destructive">*</span>
          </label>
          <select
            id="user-branch"
            value={form.branchId}
            onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value ? Number(e.target.value) : '' }))}
            className={inputClass}
          >
            <option value="">Pilih cabang</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <span className="block text-sm font-medium text-foreground mb-1">Cabang tugas lain</span>
          <p className="text-xs text-muted-foreground mb-2">
            Cabang lain tempat orang ini boleh bertugas. Ia memilih satu cabang aktif saat bekerja;
            cabang utama selalu termasuk.
          </p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto border border-border rounded-md p-2.5">
            {branches
              .filter((branch) => branch.id !== form.branchId)
              .map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.assignedBranchIds.includes(branch.id)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        assignedBranchIds: e.target.checked
                          ? [...f.assignedBranchIds, branch.id]
                          : f.assignedBranchIds.filter((id) => id !== branch.id),
                      }))
                    }
                    className="rounded border-border"
                  />
                  {branch.name}
                </label>
              ))}
            {branches.filter((branch) => branch.id !== form.branchId).length === 0 && (
              <p className="text-xs text-muted-foreground">Tidak ada cabang lain.</p>
            )}
          </div>
        </div>
      </div>

      {user && (
        <div className="pt-1">
          <button
            type="button"
            onClick={handleReset}
            disabled={busy}
            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResetting ? 'Mereset...' : 'Reset kredensial ke default'}
          </button>
        </div>
      )}

      {resetMsg && (
        <div
          role="status"
          aria-live="polite"
          className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm"
        >
          {resetMsg}
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
          onClick={() => router.push('/settings/users')}
          disabled={busy}
          className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Menyimpan...' : user ? 'Simpan Perubahan' : 'Tambah Pengguna'}
        </button>
      </div>
    </form>
  )
}
