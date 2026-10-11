'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { NewBadge } from '@/components/ui/new-badge'
import { formatDateTimeWib, formatRupiah } from '@/components/supplier-returns/types'

export interface ReturnableTransferOption {
  transferId: number
  ibtNumber: string
  trxNumber: string
  senderBranchName: string
  receiverBranchName: string
  receivedAt: string | null
  total: number
}

/**
 * Daftar kiriman yang bisa diretur — supaya nomor kiriman tidak perlu diketik manual
 * (permintaan owner 2026-10-11). Kiriman yang paling baru diterima tampil paling atas;
 * memilih satu baris sama dengan mengetik nomornya lalu menekan Cari.
 */
export function TransferPicker({
  apiBase,
  onPick,
  disabled,
}: {
  /** `/api/pos/internal-returns` atau `/api/bo/internal-returns`. */
  apiBase: string
  onPick: (ibtNumber: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ReturnableTransferOption[] | null>(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || rows !== null || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiBase}/candidates`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? 'Gagal memuat daftar kiriman')
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!rows || !q) return rows ?? []
    return rows.filter(r =>
      `${r.ibtNumber} ${r.trxNumber} ${r.senderBranchName} ${r.receiverBranchName}`.toLowerCase().includes(q),
    )
  }, [rows, filter])

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50 min-h-[44px]"
      >
        <span className="flex items-center gap-2">Atau pilih dari daftar kiriman (terbaru di atas) <NewBadge feature="fitur/daftar-pilih-kiriman" /></span>
        {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>

      {open && (
        <div className="border-t border-border p-2 space-y-2">
          {loading && (
            <p className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuat daftar kiriman...
            </p>
          )}
          {error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}
          {rows !== null && rows.length === 0 && !error && (
            <p className="px-1 py-2 text-sm text-muted-foreground">Belum ada kiriman yang sudah diterima dan bisa diretur.</p>
          )}
          {rows !== null && rows.length > 0 && (
            <>
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Saring: nomor IBT, nomor nota, atau nama cabang"
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {visible.map(r => (
                  <li key={r.transferId}>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onPick(r.ibtNumber) }}
                      className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-accent min-h-[44px]"
                    >
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-mono text-sm font-semibold text-foreground">{r.ibtNumber}</span>
                        <span className="text-sm text-foreground">{formatRupiah(r.total)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.senderBranchName} → {r.receiverBranchName} · diterima {r.receivedAt ? formatDateTimeWib(r.receivedAt) : '-'} · nota{' '}
                        <span className="font-mono">{r.trxNumber}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {visible.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ada kiriman yang cocok dengan saringan.</li>
                )}
              </ul>
              <p className="px-1 text-xs text-muted-foreground">
                Menampilkan {rows.length} kiriman terakhir. Kiriman yang lebih lama tetap bisa dicari dengan mengetik nomornya di atas.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
