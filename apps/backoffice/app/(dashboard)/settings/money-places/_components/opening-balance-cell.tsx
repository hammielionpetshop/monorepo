'use client'

import { useEffect, useState } from 'react'
import { ProofPhotoField, ProofPhotoLink } from '@/components/ui/proof-photo-field'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import type { OpeningBalanceRow } from '@/lib/services/money-place-opening-balance-service'

// F2-6a-1 Saldo awal Tempat Uang (spec docs/work/specs/2026-11-12-f2-6-modul-finance-design.md §2).

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const inputClass =
  'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })
}

interface Place {
  id: number
  name: string
}

/** Isi kolom "Saldo awal 1 Nov 2026" satu Tempat Uang Tunai/Rekening. */
export function OpeningBalanceCell({
  place, rows, canManage, onOpen,
}: { place: Place; rows: OpeningBalanceRow[]; canManage: boolean; onOpen: () => void }) {
  const active = rows.find((r) => !r.cancelledAt)
  if (!active) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800">belum diisi</span>
        {(canManage || rows.length > 0) && (
          <button onClick={onOpen} className="text-xs font-medium text-primary hover:underline">
            {canManage ? 'Isi saldo awal' : 'Riwayat'}
          </button>
        )}
      </span>
    )
  }
  return (
    <button onClick={onOpen} className="text-left hover:underline" title={`Rincian saldo awal ${place.name}`}>
      <span className="font-medium text-foreground tabular-nums">{IDR.format(active.amount)}</span>
      {!active.proofPhotoUrl && <span className="block text-xs text-muted-foreground">tanpa bukti</span>}
    </button>
  )
}

/** Dialog isi / batal / riwayat saldo awal satu Tempat Uang. */
export function OpeningBalanceDialog({
  place, rows, canManage, onClose, onChanged,
}: {
  place: Place
  rows: OpeningBalanceRow[]
  canManage: boolean
  onClose: () => void
  onChanged: (text: string) => Promise<void>
}) {
  const active = rows.find((r) => !r.cancelledAt) ?? null
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function send(url: string, body: unknown, okText: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error ?? `Gagal menyimpan (${res.status})`)
      await onChanged(okText)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusy(false)
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy || uploading) return
    if (amount === '') return setError('Jumlah wajib diisi (isi 0 bila kosong)')
    void send(
      '/api/bo/settings/money-places/opening-balances',
      { moneyPlaceId: place.id, amount: Number(amount), note: note.trim() || null, proofPhotoUrl: photo ?? undefined },
      `Saldo awal ${place.name} disimpan`,
    )
  }

  function cancel(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !active) return
    if (!reason.trim()) return setError('Alasan pembatalan wajib diisi')
    void send(
      `/api/bo/settings/money-places/opening-balances/${active.id}/cancel`,
      { reason: reason.trim() },
      `Saldo awal ${place.name} dibatalkan; silakan isi ulang`,
    )
  }

  const history = rows.filter((r) => r.cancelledAt)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Saldo awal ${place.name}`}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg shadow-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-foreground">Saldo awal — {place.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Isi uang di tempat ini pada <strong>1 November 2026 awal hari</strong> (sebelum ada transaksi tanggal 1). Ini titik
          mulai saldo di Finance. Tempat yang dibuka sesudah 1 November diisi 0. Saldo awal tidak bisa diubah; bila salah,
          batalkan dengan alasan lalu isi ulang.
        </p>

        {error && (
          <div role="alert" className="mt-3 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
            {error}
          </div>
        )}

        {active ? (
          <div className="mt-4 rounded-md border border-border p-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">Saldo awal berlaku</span>
              <span className="font-semibold tabular-nums text-foreground">{IDR.format(active.amount)}</span>
            </div>
            {active.note && <p className="mt-1 text-xs text-muted-foreground">Catatan: {active.note}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              Diisi {active.createdByName ?? '—'} · {formatTime(active.createdAt)}
            </p>
            <div className="mt-1">
              {active.proofPhotoUrl ? <ProofPhotoLink url={active.proofPhotoUrl} /> : <span className="text-xs text-muted-foreground">tanpa bukti</span>}
            </div>
            {canManage && !cancelling && (
              <button onClick={() => { setCancelling(true); setError(null) }} className="mt-3 text-xs font-medium text-destructive hover:underline">
                Batalkan saldo awal
              </button>
            )}
            {canManage && cancelling && (
              <form onSubmit={cancel} className="mt-3 space-y-2">
                <label className="block text-xs font-medium text-foreground">
                  Alasan pembatalan
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} className={`mt-1 ${inputClass}`} autoFocus />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCancelling(false)} disabled={busy} className="px-3 py-1.5 text-xs border border-border rounded-md">
                    Tidak jadi
                  </button>
                  <button type="submit" disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-md bg-destructive text-destructive-foreground disabled:opacity-50">
                    {busy ? 'Menyimpan…' : 'Batalkan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : canManage ? (
          <form onSubmit={save} className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-foreground">
              Jumlah per 1 Nov 2026
              <input
                type="text"
                inputMode="numeric"
                value={formatRupiahInput(amount)}
                onChange={(e) => setAmount(digitsOnly(e.target.value))}
                placeholder="0"
                className={`mt-1 ${inputClass}`}
                autoFocus
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              Catatan <span className="font-normal text-muted-foreground">(boleh kosong)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={255}
                placeholder="mis. sesuai mutasi BCA 31 Okt"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <ProofPhotoField value={photo} onChange={setPhoto} onUploadingChange={setUploading} disabled={busy} label="Foto bukti (mutasi bank / hitungan)" />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm border border-border rounded-md">
                Tutup
              </button>
              <button
                type="submit"
                disabled={busy || uploading}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? 'Menyimpan…' : 'Simpan saldo awal'}
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Belum diisi. Saldo awal diisi oleh Owner atau GM.</p>
        )}

        {history.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Riwayat dibatalkan</h3>
            <ul className="mt-2 space-y-2">
              {history.map((r) => (
                <li key={r.id} className="text-xs text-muted-foreground border-l-2 border-border pl-2">
                  <span className="line-through tabular-nums">{IDR.format(r.amount)}</span> · diisi {r.createdByName ?? '—'}{' '}
                  {formatTime(r.createdAt)} · dibatalkan {r.cancelledAt ? formatTime(r.cancelledAt) : ''}: {r.cancelReason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(active || !canManage) && (
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm border border-border rounded-md">Tutup</button>
          </div>
        )}
      </div>
    </div>
  )
}
