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

  async function handleSelect(branch: Branch) {
    setLoading(branch.id)
    setError('')
    try {
      const res = await fetch('/api/pos/set-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch.id }),
      })
      if (!res.ok) throw new Error('Gagal memilih cabang')
      router.push('/pos')
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
    </div>
  )
}
