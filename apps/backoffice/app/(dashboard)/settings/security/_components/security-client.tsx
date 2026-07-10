'use client'

import { useState, useEffect, FormEvent } from 'react'

interface Props {
  initialPassword: string
  initialPin: string
}

export default function SecurityClient({ initialPassword, initialPin }: Props) {
  const [defaultPassword, setDefaultPassword] = useState(initialPassword)
  const [defaultPin, setDefaultPin] = useState(initialPin)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setSaving(true)
    try {
      const res = await fetch('/api/bo/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultPassword, defaultPin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal menyimpan (${res.status})`)
        return
      }
      setDefaultPassword(data.defaultPassword)
      setDefaultPin(data.defaultPin)
      setSuccessMsg('Kredensial default berhasil disimpan')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg">
      {successMsg && (
        <div role="status" aria-live="polite" className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}
      {errorMsg && !successMsg && (
        <div role="alert" aria-live="assertive" className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md text-xs leading-relaxed">
        Nilai ini dipakai sebagai password &amp; PIN awal untuk akun staf baru (atau saat kredensial
        di-reset). Staf wajib menggantinya saat login pertama. Simpan &amp; sampaikan dengan aman.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-lg p-6">
        <div className="space-y-2">
          <label htmlFor="defaultPassword" className="text-sm font-medium text-foreground">
            Password Default
          </label>
          <div className="flex gap-2">
            <input
              id="defaultPassword"
              type={showPassword ? 'text' : 'password'}
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              required
              minLength={6}
              maxLength={100}
              autoComplete="off"
              className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="px-3 py-2 text-xs font-medium text-muted-foreground border border-input rounded-md hover:bg-accent hover:text-foreground transition-colors"
            >
              {showPassword ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Minimal 6 karakter.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="defaultPin" className="text-sm font-medium text-foreground">
            PIN Default
          </label>
          <input
            id="defaultPin"
            type={showPassword ? 'text' : 'password'}
            inputMode="numeric"
            value={defaultPin}
            onChange={(e) => setDefaultPin(e.target.value.replace(/\D/g, ''))}
            required
            maxLength={6}
            autoComplete="off"
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary tracking-[0.3em]"
          />
          <p className="text-xs text-muted-foreground">4–6 digit angka.</p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  )
}
