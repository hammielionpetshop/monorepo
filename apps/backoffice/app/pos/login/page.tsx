'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function PosLoginPage() {
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
        body: JSON.stringify({ mode: 'email_password', email: email.trim(), password }),
      })

      let data: { user?: { role: string }; error?: string } = {}
      const contentType = res.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await res.json()
      } else {
        throw new Error('Format respons tidak valid')
      }

      if (!res.ok) {
        setError(data.error || 'Login gagal')
        setLoading(false)
        return
      }

      if (data.user?.role === 'KASIR') {
        router.push('/pos')
      } else if (['OWNER', 'GM', 'MANAGER'].includes(data.user?.role ?? '')) {
        router.push('/pos/select-branch')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      console.error(err)
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <span className="text-4xl">🦁</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Hammielion
          </h1>
          <p className="text-muted-foreground mt-2 text-base font-medium">
            Web POS
          </p>
        </div>

        <div className="bg-card p-7 rounded-2xl border border-border shadow-xl shadow-black/5">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-card-foreground">Masuk ke Kasir</h2>
            <p className="text-base text-muted-foreground mt-1">
              Gunakan akun kasir Anda untuk melanjutkan.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-base font-semibold flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-4 bg-background border border-input rounded-xl text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[52px]"
                placeholder="kasir@hammielion.id"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">
                Kata Sandi
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-4 bg-background border border-input rounded-xl text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm min-h-[52px]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[52px] px-4 bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 mt-2"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Memproses...
                </div>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Hammielion Group
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
