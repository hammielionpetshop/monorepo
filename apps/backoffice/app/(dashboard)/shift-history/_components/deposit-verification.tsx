'use client'

import { useState } from 'react'
import { formatWIB } from '@petshop/shared'
import { formatRupiahInput, parseRupiahInput } from '@/lib/number-input'

export type DepositInfo = {
  depositReceivedCash: number | null
  depositVariance: number | null
  depositVerifiedAt: string | null
  depositVerifiedByName: string | null
  depositNotes: string | null
}

type Props = {
  shiftId: number
  status: string
  totalClosingCashReal: number | null
  totalClosingCashExpected: number | null
  deposit: DepositInfo
  canVerify: boolean
  canCorrect: boolean
  onSaved: (deposit: DepositInfo) => void
}

function formatRupiah(amount: number | null | undefined) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function varianceClass(v: number) {
  return v < 0 ? 'text-red-600' : v > 0 ? 'text-green-600' : 'text-muted-foreground'
}

export function DepositVerification({
  shiftId,
  status,
  totalClosingCashReal,
  totalClosingCashExpected,
  deposit,
  canVerify,
  canCorrect,
  onSaved,
}: Props) {
  const isVerified = deposit.depositVerifiedAt != null
  const [isEditing, setIsEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isForceClosed = status === 'FORCE_CLOSED' || totalClosingCashReal == null
  const cashierFigure = totalClosingCashReal ?? totalClosingCashExpected ?? 0
  const amountNum = parseRupiahInput(amount)
  const previewVariance = amount ? amountNum - cashierFigure : null
  const showForm = (!isVerified && canVerify) || isEditing

  function startEdit() {
    setAmount(formatRupiahInput(deposit.depositReceivedCash ?? 0))
    setNotes(deposit.depositNotes ?? '')
    setError(null)
    setIsEditing(true)
  }

  async function submit() {
    if (!amount) {
      setError('Isi jumlah kas yang diterima')
      return
    }
    if (previewVariance !== 0 && !notes.trim()) {
      setError('Kas diterima berbeda dengan setoran kasir — catatan wajib diisi')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/shifts/${shiftId}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedCash: amountNum, notes: notes.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Gagal menyimpan verifikasi')
      onSaved(json as DepositInfo)
      setIsEditing(false)
      setAmount('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="px-6 py-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground">Verifikasi Setoran</h4>
        {isVerified ? (
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-md border bg-green-500/10 text-green-600 border-green-500/20">
            Sudah diverifikasi
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-md border bg-amber-500/10 text-amber-700 border-amber-500/20">
            Belum diverifikasi
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            {isForceClosed ? 'Kas Sistem (tutup paksa, tanpa hitungan kasir)' : 'Setoran Menurut Kasir'}
          </p>
          <p className="text-foreground font-medium">{formatRupiah(cashierFigure)}</p>
        </div>
        {isVerified && !isEditing && (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Kas Diterima Finance</p>
              <p className="text-foreground font-medium">{formatRupiah(deposit.depositReceivedCash)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Selisih Serah-Terima</p>
              <p className={`font-medium ${varianceClass(deposit.depositVariance ?? 0)}`}>
                {formatRupiah(deposit.depositVariance)}
              </p>
            </div>
            <div className="col-span-2 md:col-span-3 text-xs text-muted-foreground">
              Diverifikasi oleh {deposit.depositVerifiedByName ?? '-'} pada{' '}
              {formatWIB(deposit.depositVerifiedAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {canCorrect && (
                <button onClick={startEdit} className="ml-3 text-primary underline hover:opacity-70">
                  Koreksi
                </button>
              )}
            </div>
            {deposit.depositNotes && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-muted-foreground mb-0.5">Catatan Finance</p>
                <p className="text-foreground">{deposit.depositNotes}</p>
              </div>
            )}
          </>
        )}
        {!isVerified && !canVerify && (
          <div className="col-span-2 text-xs text-muted-foreground self-end">
            Menunggu finance mencatat uang yang diterima.
          </div>
        )}
      </div>

      {showForm && (
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Kas yang Diterima (hasil hitung)</label>
              <input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatRupiahInput(e.target.value))}
                placeholder="0"
                className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">Selisih Serah-Terima</p>
              <p className={`py-2 text-sm font-medium ${previewVariance == null ? 'text-muted-foreground' : varianceClass(previewVariance)}`}>
                {previewVariance == null ? '-' : formatRupiah(previewVariance)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Catatan {previewVariance != null && previewVariance !== 0 ? '(wajib)' : '(opsional)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="mis. kurang 150.000, sudah dikonfirmasi ke kasir"
                className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent transition-colors"
              >
                Batal
              </button>
            )}
            <button
              onClick={() => { void submit() }}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isSaving ? 'Menyimpan...' : isEditing ? 'Simpan Koreksi' : 'Verifikasi Setoran'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
