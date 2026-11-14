'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, LayoutGrid } from 'lucide-react'
import { NewBadge } from '@/components/ui/new-badge'
import type { WebCode, WebEntry } from '@/lib/web-access'

/**
 * Tombol "Pindah web" (spec F2-7a §4): daftar web yang menjadi hak orang ini, pindah tanpa login
 * ulang. Akses web tujuan dibuka server lewat /api/gateway/open dari sesi pusat yang sama.
 */
export default function WebSwitcher({ webs, current }: { webs: WebEntry[]; current: WebCode }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<WebCode | null>(null)
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

  async function handleSelect(web: WebEntry) {
    if (web.code === current) {
      setOpen(false)
      return
    }
    setPending(web.code)
    setError('')
    try {
      const csrf = await fetch('/api/gateway/csrf', { cache: 'no-store' }).then((res) => res.json())
      const res = await fetch('/api/gateway/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf?.token ?? '' },
        body: JSON.stringify({ web: web.code }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.url !== 'string') {
        setError(data?.error ?? 'Gagal pindah web.')
        setPending(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Gagal pindah web. Periksa koneksi.')
      setPending(null)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground border border-border rounded-md hover:bg-accent transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <LayoutGrid className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        <span>Pindah web</span>
        <NewBadge feature="fitur/pindah-web" />
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 py-1" role="menu">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pindah web</p>
          {error && (
            <p className="mx-2 mb-1 px-2 py-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
              {error}
            </p>
          )}
          {webs.map((web) => (
            <button
              key={web.code}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(web)}
              disabled={pending !== null || web.needsPassword}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="min-w-0">
                <span className="block truncate text-foreground">{web.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {web.needsPassword ? `Masuk dengan password untuk membuka ${web.name}` : pending === web.code ? 'Membuka…' : web.description}
                </span>
              </span>
              {web.code === current && <Check className="w-4 h-4 flex-shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
