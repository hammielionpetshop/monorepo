'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronDown } from 'lucide-react'

interface Branch {
  id: number
  name: string
  code: string
}

export default function BranchSwitcher({
  branches,
  currentBranchId,
  currentBranchName,
}: {
  branches: Branch[]
  currentBranchId: number
  currentBranchName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleSelect(branch: Branch) {
    if (branch.id === currentBranchId) {
      setOpen(false)
      return
    }
    setPending(branch.id)
    setError('')
    try {
      const res = await fetch('/api/auth/switch-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId: branch.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Gagal pindah cabang.')
        setPending(null)
        return
      }
      // Token baru sudah terpasang di cookie. `refresh()` saja tidak cukup: banyak halaman
      // membaca cabang di server component saat render awal, jadi seluruh pohon perlu ditarik
      // ulang dari server.
      setOpen(false)
      router.refresh()
      setPending(null)
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setPending(null)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground border border-border rounded-md hover:bg-accent transition-colors max-w-[12rem]"
        title="Pindah cabang aktif"
      >
        <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">{currentBranchName}</span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cabang tugas
          </p>

          {error && (
            <p className="mx-2 mb-1 px-2 py-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
              {error}
            </p>
          )}

          {branches.map((branch) => {
            const isActive = branch.id === currentBranchId
            return (
              <button
                key={branch.id}
                onClick={() => handleSelect(branch)}
                disabled={pending !== null}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{branch.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{branch.code}</span>
                </span>
                {pending === branch.id ? (
                  <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                ) : isActive ? (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
