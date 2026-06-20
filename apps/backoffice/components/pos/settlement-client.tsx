'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Big from 'big.js'
import type { ShiftBreakdownSummary } from '@petshop/shared'
import { formatRupiah } from './cart-store'

interface SettlementClientProps {
  shiftId: number
  shiftNumber: number
  cashierId: number
}

type Step = 'BREAKDOWN' | 'INPUT' | 'CONFIRM'

export default function SettlementClient({ shiftId, shiftNumber, cashierId }: SettlementClientProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('BREAKDOWN')
  const [summary, setSummary] = useState<ShiftBreakdownSummary | null>(null)
  const [realCash, setRealCash] = useState(0)
  const [settlementNotes, setSettlementNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fetchBreakdown = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/pos/shifts/${shiftId}/breakdown`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal memuat data shift')
        return
      }
      const data: ShiftBreakdownSummary = await res.json()
      setSummary(data)
      setRealCash(data.totalExpectedCash)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }, [shiftId])

  useEffect(() => {
    fetchBreakdown()
  }, [fetchBreakdown])

  const updateRealCash = (val: string) => {
    const raw = val.replace(/\D/g, '')
    setRealCash(raw ? parseInt(raw, 10) : 0)
  }

  const expectedCash = summary?.totalExpectedCash ?? 0
  const variance = new Big(realCash).minus(expectedCash).toNumber()
  const isShort = variance < 0

  const handleSettle = async () => {
    setIsSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/pos/shifts/${shiftId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realCash,
          settlementNotes: settlementNotes.trim() || undefined,
          closedById: cashierId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Gagal menutup shift')
        return
      }
      router.push('/pos')
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepLabels: Record<Step, string> = {
    BREAKDOWN: '1. Review Penjualan',
    INPUT: '2. Input Uang Fisik',
    CONFIRM: '3. Konfirmasi',
  }
  const steps: Step[] = ['BREAKDOWN', 'INPUT', 'CONFIRM']

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Kembali"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5 text-foreground"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground">Settlement Shift #{shiftNumber}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {steps.map((s) => (
              <span
                key={s}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {stepLabels[s]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Memuat data shift...</p>
          </div>
        )}

        {/* Error state (only when not loading) */}
        {!isLoading && error && step === 'BREAKDOWN' && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 space-y-3">
            <p className="text-sm text-destructive font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchBreakdown}
              className="min-h-[44px] px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Step BREAKDOWN */}
        {!isLoading && !error && summary && step === 'BREAKDOWN' && (
          <>
            <div className="space-y-3">
              {summary.breakdowns.map((b) => (
                <div
                  key={b.cashierId}
                  className="bg-card border border-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{b.cashierName ?? 'Kasir'}</p>
                      <p className="text-xs text-muted-foreground">{b.totalTransactions} transaksi</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Kas Bersih</p>
                      <p className="text-base font-bold text-foreground">
                        {formatRupiah(String(b.expectedCash))}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Cash: {formatRupiah(String(b.totalSalesCash))}</span>
                    <span>
                      Non-Cash:{' '}
                      {formatRupiah(
                        new Big(b.totalSalesQris)
                          .add(b.totalSalesDebit)
                          .add(b.totalSalesCredit)
                          .toString()
                      )}
                    </span>
                    <span>Expense: {formatRupiah(String(b.totalExpenses))}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Expected */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-sm font-medium text-muted-foreground">Net Cash Penjualan Harus Ada</span>
                <span className="text-xl font-bold text-foreground">
                  {formatRupiah(String(summary.totalExpectedCash))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Modal Awal (terpisah, dikembalikan utuh)</span>
                <span className="text-foreground font-medium">
                  {formatRupiah(String(summary.shift.openingCash))}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Net cash = tunai diterima − kembalian − pengeluaran. Modal dihitung & disetor terpisah. Input di bawah hanya net cash penjualan (di luar modal).
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError('')
                setStep('INPUT')
              }}
              className="w-full min-h-[48px] bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              Lanjut Input Uang Fisik →
            </button>
          </>
        )}

        {/* Step INPUT */}
        {!isLoading && summary && step === 'INPUT' && (
          <>
            <div
              className={`bg-card border rounded-xl p-4 space-y-3 ${
                isShort ? 'border-destructive/50' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">Kas Penjualan di Laci</p>
                <p className="text-xs text-muted-foreground">
                  Expected: {formatRupiah(String(expectedCash))}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Total Uang Tunai di Luar Modal (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={realCash ? realCash.toLocaleString('id-ID') : ''}
                  onChange={(e) => updateRealCash(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Selisih:</span>
                <span
                  className={`font-bold ${
                    isShort
                      ? 'text-destructive'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {variance >= 0 ? '+' : ''}
                  {formatRupiah(String(variance))}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setStep('BREAKDOWN')
                }}
                className="flex-1 min-h-[48px] border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                ← Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setStep('CONFIRM')
                }}
                className="flex-[2] min-h-[48px] bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Review Final →
              </button>
            </div>
          </>
        )}

        {/* Step CONFIRM */}
        {!isLoading && summary && step === 'CONFIRM' && (
          <>
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Kas Penjualan Disetor (di luar modal)</span>
                <span className="font-bold text-foreground text-lg">
                  {formatRupiah(String(realCash))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Kas Penjualan Harus Ada</span>
                <span className="text-foreground">
                  {formatRupiah(String(expectedCash))}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Modal (terpisah, dikembalikan utuh)</span>
                <span className="text-muted-foreground">
                  {formatRupiah(String(summary.shift.openingCash))}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm text-muted-foreground">Selisih</span>
                <span
                  className={`font-bold ${
                    isShort ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {variance >= 0 ? '+' : ''}
                  {formatRupiah(String(variance))}
                </span>
              </div>
            </div>

            {isShort && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
                Terdapat selisih kurang pada kas. Selisih ini akan tercatat dalam laporan settlement.
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Catatan Settlement (Opsional)
              </label>
              <textarea
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Catatan jika ada selisih atau informasi lain..."
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setStep('INPUT')
                }}
                disabled={isSubmitting}
                className="flex-1 min-h-[48px] border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                ← Edit Input
              </button>
              <button
                type="button"
                onClick={handleSettle}
                disabled={isSubmitting}
                className="flex-[2] min-h-[48px] bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {isSubmitting ? 'Menutup Shift...' : 'Konfirmasi Tutup Shift'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
