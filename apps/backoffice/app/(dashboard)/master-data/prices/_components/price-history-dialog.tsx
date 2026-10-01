'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { formatWIB } from '@petshop/shared'
import type { PriceHistoryEntry, PriceHistoryChange } from '@/lib/services/price-service'

interface Props {
  branchId: number
  branchName: string
  productId: number
  productName: string
  uomId: number
  uomCode: string
  onClose: () => void
}

const TIER_LABELS: Record<string, string> = {
  RETAIL: 'Retail',
  RESELLER: 'Reseller',
  GROSIR: 'Grosir',
  MEMBER: 'Member',
}

function changeLabel(c: PriceHistoryChange) {
  if (c.kind === 'COST') return 'Modal'
  return c.tier ? (TIER_LABELS[c.tier] ?? c.tier) : '-'
}

function formatValue(v: number | null) {
  return v === null ? '—' : v.toLocaleString('id-ID')
}

function sourceLabel(e: PriceHistoryEntry) {
  if (e.source === 'IMPORT') return e.fileName ? `Impor file ${e.fileName}` : 'Impor file'
  if (e.source === 'COPY') return 'Salin dari produk lain'
  if (e.source === 'AUTO_SYNC') return `Otomatis dari barang masuk${e.reference ? ` (${e.reference})` : ''}`
  if (e.source === 'REVIEW') return `Disetujui dari Tinjauan Modal${e.reference ? ` (${e.reference})` : ''}`
  return 'Manual'
}

export default function PriceHistoryDialog({
  branchId,
  branchName,
  productId,
  productName,
  uomId,
  uomCode,
  onClose,
}: Props) {
  const [entries, setEntries] = useState<PriceHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    const params = new URLSearchParams({
      branchId: String(branchId),
      productId: String(productId),
      uomId: String(uomId),
    })
    fetch(`/api/bo/master-data/prices/history?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Gagal memuat riwayat harga')
        setEntries((json as { data: PriceHistoryEntry[] }).data)
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Gagal memuat riwayat harga')
      })
    return () => ctrl.abort()
  }, [branchId, productId, uomId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Riwayat Perubahan Harga</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {productName} — {uomCode} · Cabang {branchName}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[65vh] overflow-y-auto">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : entries === null ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat perubahan harga untuk satuan ini.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id} className="rounded-md border border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border text-xs">
                    <span className="font-medium text-foreground">
                      {formatWIB(e.createdAt, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      {e.userName ?? 'User dihapus'} · {sourceLabel(e)}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {e.changes.map((c, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-1.5 w-28 text-muted-foreground">{changeLabel(c)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {formatValue(c.from)}
                          </td>
                          <td className="px-1 py-1.5 w-6 text-center text-muted-foreground">→</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-foreground">
                            {c.deleted ? <span className="text-destructive">dihapus</span> : formatValue(c.to)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
          )}
          {entries !== null && entries.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Menampilkan maksimal 100 perubahan terbaru. Perubahan sebelum jejak audit harga aktif tidak tercatat.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
