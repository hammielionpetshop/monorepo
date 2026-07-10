'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

// Landing per peran (parity dengan login page & guard middleware).
function landingPathForRole(role: string): string {
  if (role === 'OWNER' || role === 'GM') return '/dashboard'
  if (role === 'KASIR') return '/pos'
  return '/staff'
}

export default function OnboardingPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }
    if (newPin !== confirmPin) {
      setError('Konfirmasi PIN tidak cocok')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, newPin }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Gagal menyimpan kredensial')
        return
      }

      router.replace(landingPathForRole(data.role))
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Amankan Akun Anda
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Login pertama — silakan ganti password &amp; buat PIN
          </p>
        </div>

        <div className="bg-card p-8 rounded-2xl border border-border shadow-xl shadow-black/5">
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Demi keamanan, Anda wajib mengganti password default dan membuat PIN sebelum
              melanjutkan. Nilai baru tidak boleh sama dengan kredensial default.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Password Baru
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                placeholder="Minimal 6 karakter"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Konfirmasi Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                placeholder="Ulangi password baru"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="newPin" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                PIN Baru
              </label>
              <input
                id="newPin"
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                maxLength={6}
                autoComplete="off"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm tracking-[0.5em]"
                placeholder="4–6 digit angka"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPin" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Konfirmasi PIN
              </label>
              <input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                required
                maxLength={6}
                autoComplete="off"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm tracking-[0.5em]"
                placeholder="Ulangi PIN baru"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 mt-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Menyimpan...
                </div>
              ) : (
                'Simpan & Lanjutkan'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
