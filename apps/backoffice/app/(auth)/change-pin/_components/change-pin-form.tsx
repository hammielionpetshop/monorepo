'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  role: string
  userName: string
  /** true → user sampai di sini karena PIN-nya di-reset OWNER, bukan atas kemauan sendiri. */
  forced: boolean
  hasPin: boolean
  hasPassword: boolean
}

// Landing per peran (parity dengan login page & guard middleware).
function landingPathForRole(role: string): string {
  if (role === 'OWNER' || role === 'GM') return '/dashboard'
  if (role === 'KASIR') return '/pos'
  return '/staff'
}

export default function ChangePinForm({ role, userName, forced, hasPin, hasPassword }: Props) {
  const router = useRouter()
  // Tanpa PIN lama, satu-satunya bukti identitas yang tersisa adalah password.
  const [credentialType, setCredentialType] = useState<'pin' | 'password'>(
    hasPin ? 'pin' : 'password'
  )
  const [currentCredential, setCurrentCredential] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const canSwitchMethod = hasPin && hasPassword

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (newPin !== confirmPin) {
      setError('Konfirmasi PIN tidak cocok')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCredential, credentialType, newPin }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Gagal mengganti PIN')
        return
      }

      router.replace(landingPathForRole(data.role))
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const currentLabel = credentialType === 'pin' ? 'PIN Saat Ini' : 'Password Anda'

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <span className="text-3xl">🔑</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            {forced ? 'Buat PIN Baru' : 'Ganti PIN'}
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">{userName}</p>
        </div>

        <div className="bg-card p-8 rounded-2xl border border-border shadow-xl shadow-black/5">
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {forced
                ? 'PIN Anda baru saja di-reset oleh pemilik, sehingga PIN yang berlaku sekarang diketahui orang lain. Buat PIN baru untuk melanjutkan.'
                : 'PIN dipakai untuk login kasir dan persetujuan di POS. Jangan bagikan ke siapa pun.'}
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
              <div className="flex items-baseline justify-between gap-2 ml-1">
                <label
                  htmlFor="currentCredential"
                  className="text-xs font-bold text-muted-foreground uppercase tracking-widest"
                >
                  {currentLabel}
                </label>
                {canSwitchMethod && (
                  <button
                    type="button"
                    onClick={() => {
                      setCredentialType((v) => (v === 'pin' ? 'password' : 'pin'))
                      setCurrentCredential('')
                      setError('')
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {credentialType === 'pin' ? 'Pakai password' : 'Pakai PIN'}
                  </button>
                )}
              </div>
              <input
                id="currentCredential"
                type="password"
                inputMode={credentialType === 'pin' ? 'numeric' : 'text'}
                value={currentCredential}
                onChange={(e) =>
                  setCurrentCredential(
                    credentialType === 'pin' ? e.target.value.replace(/\D/g, '') : e.target.value
                  )
                }
                required
                maxLength={credentialType === 'pin' ? 6 : 100}
                autoComplete="current-password"
                className={`w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm ${
                  credentialType === 'pin' ? 'tracking-[0.5em]' : ''
                }`}
                placeholder={
                  credentialType === 'pin'
                    ? forced
                      ? 'PIN dari pemilik'
                      : 'PIN lama Anda'
                    : 'Password login Anda'
                }
              />
              <p className="text-xs text-muted-foreground ml-1">
                {credentialType === 'pin'
                  ? 'Untuk memastikan yang mengganti PIN adalah Anda.'
                  : 'PIN lama tidak diperlukan bila Anda memakai password.'}
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="newPin"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1"
              >
                PIN Baru
              </label>
              <input
                id="newPin"
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                maxLength={6}
                autoComplete="off"
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm tracking-[0.5em]"
                placeholder="4–6 digit angka"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirmPin"
                className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1"
              >
                Konfirmasi PIN Baru
              </label>
              <input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
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
                'Simpan PIN Baru'
              )}
            </button>

            {/* Saat dipaksa, tidak ada jalan keluar — middleware akan memantulkan balik ke sini. */}
            {!forced && (
              <button
                type="button"
                onClick={() => router.replace(landingPathForRole(role))}
                className="w-full py-3 px-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Batal
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
