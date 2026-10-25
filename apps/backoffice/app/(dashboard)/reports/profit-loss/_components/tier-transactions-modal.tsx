'use client'

import { useState, useEffect } from 'react'
import { formatWIB } from '@petshop/shared'
import { ExternalLink } from 'lucide-react'

type TierTransaction = {
  id: number
  trxNumber: string
  createdAt: string
  cashierName: string | null
  customerName: string | null
  branchName: string | null
  payableAmount: number
}

function rupiah(amount: number | null | undefined) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function dateTime(dateStr: string) {
  return formatWIB(dateStr, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Popup daftar nota di balik angka "Jml Transaksi" per kelas harga. Satu nota bisa muncul di
 * lebih dari satu kelas harga bila notanya memuat baris dari beberapa kelas (hitungannya memang
 * COUNT DISTINCT per kelas). Tiap baris membuka notanya di tab baru.
 */
export function TierTransactionsModal({
  startDate,
  endDate,
  tier,
  tierLabel,
  branchId,
  branchName,
  count,
  onClose,
}: {
  startDate: string
  endDate: string
  tier: string
  tierLabel: string
  branchId: number | null
  branchName: string
  count: number
  onClose: () => void
}) {
  const [items, setItems] = useState<TierTransaction[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const showBranch = branchId == null

  useEffect(() => {
    let active = true
    setItems(null)
    setError(null)
    const params = new URLSearchParams({ startDate, endDate, tier })
    if (branchId != null) params.set('branchId', String(branchId))
    fetch(`/api/bo/reports/profit-loss/tier-transactions?${params}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error ?? 'Gagal memuat transaksi')
        if (active) setItems(data.transactions ?? [])
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Gagal memuat transaksi')
      })
    return () => {
      active = false
    }
  }, [startDate, endDate, tier, branchId])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Transaksi kelas harga {tierLabel}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {branchName} — {startDate} s/d {endDate} — {count} nota. Klik baris untuk membuka notanya.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none" aria-label="Tutup">
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {error ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">{error}</div>
          ) : items === null ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada transaksi.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Tanggal</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Nota</th>
                    {showBranch && <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Cabang</th>}
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Pelanggan</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Nominal</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => window.open(`/transactions?trx=${encodeURIComponent(t.trxNumber)}`, '_blank')}
                      className="border-b border-border hover:bg-accent/60 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{dateTime(t.createdAt)}</td>
                      <td className="px-3 py-2 font-mono text-foreground whitespace-nowrap">{t.trxNumber}</td>
                      {showBranch && <td className="px-3 py-2 text-foreground whitespace-nowrap">{t.branchName ?? '-'}</td>}
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">{t.customerName ?? 'Umum'}</td>
                      <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">{rupiah(t.payableAmount)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        <ExternalLink className="w-3.5 h-3.5 inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
