'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

// Landing per peran (parity dengan guard middleware):
// OWNER/GM boleh melihat /dashboard (omzet & laba global); MANAGER/GUDANG/FINANCE
// diarahkan ke /staff (tanpa data global); KASIR ke POS.
function landingPathForRole(role: string): string {
  if (role === 'OWNER' || role === 'GM') return '/dashboard'
  if (role === 'KASIR') return '/pos'
  return '/staff'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'email_password', email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login gagal')
        return
      }

      router.push(landingPathForRole(data.user?.role))
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Branding Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <span className="text-3xl">🦁</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Hammielion
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Enterprise Backoffice System
          </p>
        </div>

        <div className="bg-card p-8 rounded-2xl border border-border shadow-xl shadow-black/5">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-card-foreground">Selamat Datang</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Silakan masuk ke akun Anda untuk melanjutkan.
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
              <label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Alamat Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                placeholder="admin@hammielion.id"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Kata Sandi
                </label>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm"
                placeholder="••••••••"
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
                  Memproses...
                </div>
              ) : (
                'Masuk ke Dashboard'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Hammielion Group. Seluruh hak cipta dilindungi.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
