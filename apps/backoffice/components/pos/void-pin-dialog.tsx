'use client'

import { useState, useEffect } from 'react'

interface VoidPinDialogProps {
  isOpen: boolean
  transactionId: number
  trxNumber: string
  onClose: () => void
  onSuccess: () => void
}

export default function VoidPinDialog({
  isOpen,
  transactionId,
  trxNumber,
  onClose,
  onSuccess,
}: VoidPinDialogProps) {
  // Dua jalur, bukan satu. PIN mensyaratkan orang berwenang hadir di mesin kasir; kalau ia
  // sedang tidak di toko, satu-satunya jalan dulu adalah meminjam PIN lewat telepon — dan
  // jejak auditnya lalu mencatat persetujuan dari orang yang tidak ada di sana.
  const [mode, setMode] = useState<'pin' | 'ajukan'>('pin')
  const [pin, setPin] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMode('pin')
      setPin('')
      setReason('')
      setSubmitted(false)
      setError('')
      setIsProcessing(false)
    }
  }, [isOpen])

  // Tutup dengan ESC saat tidak processing
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isProcessing, onClose])

  if (!isOpen) return null

  const handleAjukan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 3 || isProcessing) return
    setIsProcessing(true)
    setError('')

    try {
      const res = await fetch(`/api/pos/transactions/${transactionId}/request-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'VOID', reason: reason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Gagal mengajukan pembatalan. Coba lagi.')
        return
      }
      // Sengaja TIDAK memanggil onSuccess(): notanya belum berubah apa-apa, dan menutup
      // dialog seolah selesai akan membuat kasir mengira transaksinya sudah dibatalkan.
      setSubmitted(true)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 4 || isProcessing) return
    setIsProcessing(true)
    setError('')

    try {
      const pinRes = await fetch('/api/pos/void/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!pinRes.ok) {
        const data = await pinRes.json()
        setError(data.error ?? 'PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar.')
        return
      }

      const voidRes = await fetch(`/api/pos/transactions/${transactionId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!voidRes.ok) {
        const data = await voidRes.json()
        setError(data.error ?? 'Gagal membatalkan transaksi. Coba lagi.')
        return
      }

      onSuccess()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60"
        role="presentation"
      />
      <div
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] bg-background rounded-2xl shadow-xl max-w-sm mx-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Otorisasi Void Transaksi"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Otorisasi Void</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full transition-colors disabled:opacity-40"
            aria-label="Tutup dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="p-5 space-y-4 text-center">
            <p className="text-sm text-foreground">
              Pembatalan <strong>{trxNumber}</strong> sudah diajukan dan menunggu persetujuan.
            </p>
            <p className="text-xs text-muted-foreground">
              Transaksinya <strong>belum dibatalkan</strong> — nota masih berlaku sampai
              permintaan ini disetujui.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Tutup
            </button>
          </div>
        ) : (
        <>
        <div className="px-5 pt-4 flex gap-2">
          {([
            { value: 'pin' as const, label: 'Input PIN' },
            { value: 'ajukan' as const, label: 'Ajukan persetujuan' },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setMode(opt.value); setError('') }}
              disabled={isProcessing}
              className={`flex-1 min-h-[40px] text-sm font-semibold rounded-xl border transition-colors disabled:opacity-40 ${
                mode === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'ajukan' ? (
          <form onSubmit={handleAjukan} className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Ajukan pembatalan <strong className="text-foreground">{trxNumber}</strong> untuk
              disetujui atasan. Transaksi belum berubah sampai disetujui.
            </p>

            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              disabled={isProcessing}
              maxLength={500}
              rows={3}
              placeholder="Alasan pembatalan…"
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              aria-label="Alasan pembatalan"
            />

            {error && (
              <p className="text-xs text-destructive font-medium text-center" role="alert">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 min-h-[44px] border border-border text-foreground font-semibold rounded-xl hover:bg-accent disabled:opacity-40 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={reason.trim().length < 3 || isProcessing}
                className="flex-1 min-h-[44px] bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {isProcessing ? 'Mengirim...' : 'Ajukan'}
              </button>
            </div>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Masukkan PIN Owner untuk membatalkan transaksi{' '}
            <strong className="text-foreground">{trxNumber}</strong>
          </p>

          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            disabled={isProcessing}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            placeholder="••••••"
            className="w-full bg-muted border border-border rounded-xl py-3 text-center text-2xl tracking-[0.5em] font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50 min-h-[52px]"
            aria-label="PIN Owner"
          />

          {error && (
            <p className="text-xs text-destructive font-medium text-center" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 min-h-[44px] border border-border text-foreground font-semibold rounded-xl hover:bg-accent disabled:opacity-40 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pin.length < 4 || isProcessing}
              className="flex-1 min-h-[44px] bg-destructive text-destructive-foreground font-semibold rounded-xl hover:bg-destructive/90 disabled:opacity-40 transition-colors"
            >
              {isProcessing ? 'Memproses...' : 'Konfirmasi Void'}
            </button>
          </div>
        </form>
        )}
        </>
        )}
      </div>
    </>
  )
}
