'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Branch {
  id: number
  name: string
  code: string
}

export default function BranchPickerClient({
  branches,
  userName,
  currentBranchId,
}: {
  branches: Branch[]
  userName: string
  currentBranchId: number | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<number | null>(null)
  const [error, setError] = useState('')
  // OWNER/GM: kalau shift yang ia buka masih terbuka di cabang asal, server minta konfirmasi
  // dulu sebelum pindah (meninggalkan shift terbuka). Popup wajib pilih — tak tertutup klik luar.
  const [confirmState, setConfirmState] = useState<{ branch: Branch; shiftNumber: number | null } | null>(null)

  async function handleSelect(branch: Branch, confirmLeaveOpenShift = false) {
    setLoading(branch.id)
    setError('')
    try {
      const res = await fetch('/api/pos/set-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch.id, confirmLeaveOpenShift }),
      })
      if (!res.ok) {
        // Pesannya penting di sini: penolakan yang mungkin terjadi ("shift masih terbuka",
        // "tidak ditugaskan di cabang tersebut") tak bisa ditebak kasir dari layar ini.
        const data = await res.json().catch(() => null)
        if (res.status === 409 && data?.requiresConfirm) {
          setConfirmState({ branch, shiftNumber: data.shiftNumber ?? null })
          setLoading(null)
          return
        }
        setError(data?.error ?? 'Gagal memilih cabang. Silakan coba lagi.')
        setLoading(null)
        return
      }
      window.location.href = '/pos'
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary shadow-lg shadow-primary/20 mb-4">
            <span className="text-4xl">🦁</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Pilih Cabang</h1>
          <p className="text-muted-foreground mt-1 text-base">Halo, {userName}</p>
        </div>

        <div className="bg-card p-6 rounded-2xl border border-border shadow-xl shadow-black/5 space-y-3">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold">
              {error}
            </div>
          )}

          {branches.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">
              Tidak ada cabang aktif.
            </p>
          )}

          {branches.map((branch) => {
            const isActive = branch.id === currentBranchId
            const isLoading = loading === branch.id

            return (
              <button
                key={branch.id}
                onClick={() => handleSelect(branch)}
                disabled={loading !== null}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border text-left transition-all
                  ${isActive
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50 text-foreground'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div>
                  <p className="font-bold text-base">{branch.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{branch.code}</p>
                </div>
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                ) : isActive ? (
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg flex-shrink-0">
                    Aktif
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">Shift Masih Terbuka</h2>
            </div>
            <div className="p-5 text-sm text-foreground">
              {confirmState.shiftNumber != null ? (
                <>
                  Shift <span className="font-semibold">#{confirmState.shiftNumber}</span> di cabang ini
                  masih terbuka atas nama Anda. Anda tetap bisa pindah ke{' '}
                  <span className="font-semibold">{confirmState.branch.name}</span>, tapi shift itu akan
                  ditinggal terbuka.
                </>
              ) : (
                <>
                  Masih ada shift terbuka atas nama Anda di cabang ini. Anda tetap bisa pindah ke{' '}
                  <span className="font-semibold">{confirmState.branch.name}</span>, tapi shift itu akan
                  ditinggal terbuka.
                </>
              )}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                disabled={loading !== null}
                className="flex-1 border border-border text-foreground font-medium rounded-lg min-h-[44px] px-4 py-2 hover:bg-muted transition-colors disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const branch = confirmState.branch
                  setConfirmState(null)
                  handleSelect(branch, true)
                }}
                disabled={loading !== null}
                className="flex-1 bg-primary text-primary-foreground font-semibold rounded-lg min-h-[44px] px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                Lanjut Pindah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
