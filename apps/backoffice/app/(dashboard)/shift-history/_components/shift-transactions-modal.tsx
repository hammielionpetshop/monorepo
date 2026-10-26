'use client'

import { useState, useEffect } from 'react'
import { formatWIB } from '@petshop/shared'
import { ExternalLink } from 'lucide-react'
import { TierTags } from '@/components/ui/tier-tags'

type PaymentLine = { methodName: string; type: string; amount: number }

type ShiftTransaction = {
  id: number
  trxNumber: string
  createdAt: string
  cashierName: string | null
  customerName: string | null
  payableAmount: number
  returnAmount: number
  paymentKind: string
  payments: PaymentLine[]
  tiers: string[]
}

function rupiah(amount: number | null | undefined) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function time(dateStr: string) {
  return formatWIB(dateStr, { hour: '2-digit', minute: '2-digit' })
}

const KIND_BADGE: Record<string, { label: string; className: string }> = {
  CASH: { label: 'Tunai', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  NONCASH: { label: 'Non-Tunai', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  DEBT: { label: 'Hutang', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  MIXED: { label: 'Campuran', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  NONE: { label: '-', className: 'bg-muted text-muted-foreground border-border' },
}

/**
 * Popup daftar nota di balik angka "Trx" Breakdown Kasir. Setiap baris membuka nota aslinya
 * di tab baru lewat /transactions?trx=<nomor> — pola yang sama dengan tautan "Nota Asal".
 */
export function ShiftTransactionsModal({
  shiftId,
  shiftNumber,
  cashierId,
  cashierName,
  trxCount,
  onClose,
}: {
  shiftId: number
  shiftNumber: number
  cashierId: number
  cashierName: string
  trxCount: number
  onClose: () => void
}) {
  const [items, setItems] = useState<ShiftTransaction[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setItems(null)
    setError(null)
    fetch(`/api/bo/shifts/${shiftId}/transactions?cashierId=${cashierId}`)
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
  }, [shiftId, cashierId])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Transaksi {cashierName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Shift #{shiftNumber} — {trxCount} nota. Klik baris untuk membuka notanya.
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
              {Array.from({ length: 5 }).map((_, i) => (
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
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Waktu</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Nota</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Pelanggan</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Bayar</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Metode</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Tier</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Nominal</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const badge = KIND_BADGE[t.paymentKind] ?? KIND_BADGE.NONE
                    const methods = t.payments.length > 0 ? t.payments.map((p) => p.methodName).join(', ') : '-'
                    return (
                      <tr
                        key={t.id}
                        onClick={() => window.open(`/transactions?trx=${encodeURIComponent(t.trxNumber)}`, '_blank')}
                        className="border-b border-border hover:bg-accent/60 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{time(t.createdAt)}</td>
                        <td className="px-3 py-2 font-mono text-foreground whitespace-nowrap">{t.trxNumber}</td>
                        <td className="px-3 py-2 text-foreground whitespace-nowrap">{t.customerName ?? 'Umum'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${badge.className}`}>{badge.label}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{methods}</td>
                        <td className="px-3 py-2 whitespace-nowrap"><TierTags tiers={t.tiers} /></td>
                        <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap tabular-nums">
                          {t.returnAmount > 0 ? (
                            <>
                              {rupiah(t.payableAmount - t.returnAmount)}
                              <div className="text-[11px] font-normal text-destructive">retur −{rupiah(t.returnAmount)}</div>
                              <div className="text-[11px] font-normal text-muted-foreground line-through">{rupiah(t.payableAmount)}</div>
                            </>
                          ) : (
                            rupiah(t.payableAmount)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          <ExternalLink className="w-3.5 h-3.5 inline" />
                        </td>
                      </tr>
                    )
                  })}
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
