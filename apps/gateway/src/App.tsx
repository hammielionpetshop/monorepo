import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, loadView, login, logout, nextStep, openWeb, type GatewayView, type Step, type WebEntry } from './api'

const WEB_LABEL: Record<string, string> = { pos: 'POS', hris: 'HRIS', finance: 'Finance', logistik: 'Logistik' }

/** `?dari=hris` dipasang tombol Pindah web di web lain; web itu diberi tanda "sedang dibuka". */
function currentFrom(): string | null {
  const value = new URLSearchParams(window.location.search).get('dari')
  return value && value in WEB_LABEL ? value : null
}

export function App() {
  const from = currentFrom()
  const [view, setView] = useState<GatewayView | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const go = useCallback(async (web: WebEntry) => {
    setBusy(web.code)
    setError('')
    try {
      const { url } = await openWeb(web.code)
      window.location.href = url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuka web. Periksa koneksi.')
      setBusy(null)
      setStep({ kind: 'list' })
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const loaded = await loadView()
      const next = nextStep(loaded, from !== null)
      setView(loaded)
      setStep(next)
      if (next.kind === 'auto-open') await go(next.web)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat. Periksa koneksi.')
      setStep({ kind: 'login' })
    }
  }, [from, go])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy('login')
    setError('')
    try {
      await login(String(form.get('identifier') ?? ''), String(form.get('password') ?? ''))
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk. Periksa koneksi.')
    } finally {
      setBusy(null)
    }
  }

  async function onLogout() {
    setBusy('logout')
    try {
      await logout()
    } catch {
      // Tetap kembali ke form masuk; sesi yang gagal dicabut akan kedaluwarsa sendiri.
    }
    setBusy(null)
    setView(null)
    setStep({ kind: 'login' })
    window.history.replaceState(null, '', '/')
  }

  return (
    <main className="page">
      <section className="card">
        <header className="brand">
          <h1>Hammielion</h1>
          {view && step?.kind !== 'login' && <p className="muted">Masuk sebagai <strong>{view.name}</strong></p>}
        </header>

        {error && <p className="alert" role="alert">{error}</p>}

        {step === null && <p className="muted">Memuat…</p>}

        {step?.kind === 'login' && (
          <form onSubmit={onLogin} className="form">
            <label>
              Username atau email
              <input name="identifier" autoComplete="username" required autoFocus />
            </label>
            <label>
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <button type="submit" className="primary" disabled={busy !== null}>
              {busy === 'login' ? 'Memeriksa…' : 'Masuk'}
            </button>
            <p className="muted small">Kasir masuk dengan PIN langsung di layar POS.</p>
          </form>
        )}

        {step?.kind === 'auto-open' && <p className="muted">Membuka {step.web.name}…</p>}

        {step?.kind === 'list' && view && (
          <ul className="webs">
            {view.webs.map((web) => (
              <li key={web.code}>
                <button
                  type="button"
                  className="web"
                  onClick={() => go(web)}
                  disabled={busy !== null || web.needsPassword}
                >
                  <span className="web-name">
                    {web.name}
                    {from === web.code && <span className="tag">Sedang dibuka</span>}
                  </span>
                  <span className="muted small">
                    {web.needsPassword ? `Masuk dengan password untuk membuka ${web.name}` : busy === web.code ? 'Membuka…' : web.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {step?.kind === 'no-access' && <p>Akun belum punya akses web. Hubungi Owner/GM.</p>}

        {step?.kind === 'change-password' && (
          <div className="form">
            <p>Ganti password awal lebih dulu sebelum membuka aplikasi.</p>
            {step.url
              ? <a className="primary button" href={step.url}>Ganti password di {view?.changePasswordAt === 'hris' ? 'HRIS' : 'POS'}</a>
              : <p className="muted">Hubungi Owner/GM untuk mengatur password.</p>}
          </div>
        )}

        {step && step.kind !== 'login' && (
          <footer className="footer">
            <button type="button" className="link" onClick={onLogout} disabled={busy !== null}>
              {busy === 'logout' ? 'Keluar…' : 'Keluar'}
            </button>
          </footer>
        )}
      </section>
    </main>
  )
}
