'use client'

import { useState, useEffect, FormEvent } from 'react'
import type { StaffPinItem } from './types'

interface Props {
  staff: StaffPinItem
  defaultPin: string
  onClose: () => void
  onSuccess: (pin: string) => void
  onError: (message: string) => void
}

export default function ResetPinDialog({ staff, defaultPin, onClose, onSuccess, onError }: Props) {
  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, saving])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'custom' && !/^\d{4,6}$/.test(newPin)) {
      setError('PIN harus 4–6 digit angka')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/bo/settings/users/${staff.id}/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'default' ? { mode: 'default' } : { mode: 'custom', newPin }),
      })
      const data = await res.json()
      if (!res.ok) {
        onError(data.error ?? `Gagal mereset PIN (${res.status})`)
        return
      }
      onSuccess(data.pin)
    } catch {
      onError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pin-title"
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 id="reset-pin-title" className="text-base font-semibold text-foreground">
            Reset PIN — {staff.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staff.roleName} · {staff.branchName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 border border-input rounded-md cursor-pointer hover:bg-accent/50 transition-colors">
              <input
                type="radio"
                name="mode"
                value="default"
                checked={mode === 'default'}
                onChange={() => setMode('default')}
                className="mt-0.5"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-foreground">PIN default</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Pakai PIN default dari Pengaturan › Keamanan (
                  <span className="font-mono tracking-widest">{defaultPin}</span>).
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 border border-input rounded-md cursor-pointer hover:bg-accent/50 transition-colors">
              <input
                type="radio"
                name="mode"
                value="custom"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                className="mt-0.5"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-foreground">PIN sementara sendiri</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Tentukan PIN sekali pakai khusus untuk staf ini.
                </span>
              </span>
            </label>
          </div>

          {mode === 'custom' && (
            <div className="space-y-2">
              <label htmlFor="newPin" className="text-sm font-medium text-foreground">
                PIN Sementara
              </label>
              <input
                id="newPin"
                type="text"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                autoComplete="off"
                autoFocus
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary tracking-[0.3em]"
                placeholder="4–6 digit angka"
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            Password {staff.name} tidak berubah. Setelah reset, dia wajib membuat PIN sendiri saat
            login berikutnya.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-muted-foreground border border-input rounded-md hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Mereset...' : 'Reset PIN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
