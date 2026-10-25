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
  // OWNER/GM: server minta konfirmasi dulu kalau shift yang ia buka masih terbuka di cabang
  // asal. Popup wajib pilih — tidak ditutup klik luar / Esc.
  const [confirmState, setConfirmState] = useState<{ branch: Branch; shiftNumber: number | null } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleSelect(branch: Branch, confirmLeaveOpenShift = false) {
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
        body: JSON.stringify({ branchId: branch.id, confirmLeaveOpenShift }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (res.status === 409 && data?.requiresConfirm) {
          setConfirmState({ branch, shiftNumber: data.shiftNumber ?? null })
          setPending(null)
          return
        }
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

      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Shift Masih Terbuka</h2>
            </div>
            <div className="p-4 text-sm text-foreground">
              {confirmState.shiftNumber != null ? (
                <>
                  Shift <span className="font-semibold">#{confirmState.shiftNumber}</span> di{' '}
                  <span className="font-semibold">{currentBranchName}</span> masih terbuka atas nama Anda.
                  Anda tetap bisa pindah ke <span className="font-semibold">{confirmState.branch.name}</span>,
                  tapi shift itu akan ditinggal terbuka.
                </>
              ) : (
                <>
                  Masih ada shift terbuka atas nama Anda di{' '}
                  <span className="font-semibold">{currentBranchName}</span>. Anda tetap bisa pindah ke{' '}
                  <span className="font-semibold">{confirmState.branch.name}</span>, tapi shift itu akan
                  ditinggal terbuka.
                </>
              )}
            </div>
            <div className="flex gap-2 p-4 pt-0">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                disabled={pending !== null}
                className="flex-1 border border-border text-foreground font-medium rounded-lg px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-60"
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
                disabled={pending !== null}
                className="flex-1 bg-primary text-primary-foreground font-semibold rounded-lg px-4 py-2 text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
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
